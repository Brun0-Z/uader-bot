import { Injectable, Logger } from '@nestjs/common';
import { chromium, Browser, Page } from 'playwright';
import { JobScraperStrategy, ScrapedInternship } from './job-scraper.interface';

@Injectable()
export class UaderStrategy implements JobScraperStrategy {
  public name = 'UADER FCyT Extensión';
  private readonly logger = new Logger(UaderStrategy.name);

  // URL Correcta: Categoría Secretaría de Extensión
  private readonly TARGET_URL =
    'https://fcyt.uader.edu.ar/category/sec-de-extension/';

  // Palabras Clave (Keywords) para el filtrado
  // Usamos minúsculas y sin acentos para normalizar la búsqueda
  private readonly KEYWORDS = ['pasantia', 'pasantía', 'rentada', 'fcyt'];

  async scrape(): Promise<ScrapedInternship[]> {
    this.logger.log('Analizando artículos en Secretaría de Extensión...');

    let browser: Browser | null = null;
    const results: ScrapedInternship[] = [];

    try {
      browser = await chromium.launch({
        headless: true, // Cambiar a false si quiere ver qué hace el bot en su PC
        args: ['--no-sandbox'], // Necesario para Docker/Linux
      });

      const page = await browser.newPage();

      // 1. Navegar al listado general
      await page.goto(this.TARGET_URL, { waitUntil: 'domcontentloaded' });

      // 2. Obtener todos los artículos del listado (Vista Previa)
      // Como es WordPress, cada item suele ser un <article>
      const articles = page.locator('article');
      const count = await articles.count();

      this.logger.log(`Analizando ${count} artículos recientes...`);

      // Iteramos sobre los artículos encontrados
      // (Limitamos a los últimos 5 para no procesar historia antigua innecesariamente)
      const limit = Math.min(count, 5);

      for (let i = 0; i < limit; i++) {
        const article = articles.nth(i);

        // Extraemos el Título de la vista previa
        // Selector: Generalmente es h2.entry-title a o h3.entry-title a
        const titleElement = article.locator('.entry-title a').first();
        const rawTitle = await titleElement.innerText();
        const url = await titleElement.getAttribute('href');

        if (!rawTitle || !url) continue;

        // 3. LÓGICA DE FILTRADO (El "Portero")
        if (this.isInternship(rawTitle)) {
          this.logger.log(
            `Pasantía detectada: "${rawTitle}". Profundizando...`,
          );

          // Solo si pasa el filtro, entramos al detalle
          const detailData = await this.scrapePostDetail(
            browser,
            url,
            rawTitle,
          );
          if (detailData) {
            results.push(detailData);
          }
        } else {
          this.logger.debug(`Ignorado (No es pasantía): "${rawTitle}"`);
        }
      }
    } catch (e: unknown) {
      this.logger.error(
        `Error crítico scrapeando UADER: ${(e as Error).message}`,
      );
    } finally {
      if (browser) await browser.close();
    }

    return results;
  }

  /**
   * Determina si un título corresponde a una pasantía basado en palabras clave.
   */
  private isInternship(title: string): boolean {
    const normalizedTitle = title.toLowerCase();
    // Verifica si contiene "pasantia" O "pasantía"
    // Si quiere ser muy estricto con "Rentada", agregue: && normalizedTitle.includes('rentada')
    return this.KEYWORDS.some((keyword) => normalizedTitle.includes(keyword));
  }

  /**
   * Entra a la URL específica para extraer metadatos de alta calidad (OpenGraph).
   */
  private async scrapePostDetail(
    browser: Browser,
    url: string,
    fallbackTitle: string,
  ): Promise<ScrapedInternship | null> {
    const page = await browser.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      const ogTitle = await this.getMetaContent(page, 'og:title');
      // Lógica de Imagen (La que arreglamos antes)
      let imageUrl = await this.getMetaContent(page, 'og:image');
      if (!imageUrl) {
        const thumbnailLocator = page.locator('.img-thumbnail img').first();
        if (await thumbnailLocator.count()) {
          imageUrl = await thumbnailLocator.getAttribute('src');
        }
      }

      // --- LÓGICA DE FECHA BLINDADA ---
      let publishedDate: Date | undefined;

      // 1. INTENTO A: Metadato 'article:published_time' (El ideal invisible)
      const metaDate = await this.getMetaContent(
        page,
        'article:published_time',
      );
      if (metaDate) {
        publishedDate = new Date(metaDate);
      }

      // 2. INTENTO B: Atributo 'datetime' en la etiqueta <time> (El ideal visible)
      // ESTE ES EL QUE SOLUCIONA SU PROBLEMA
      if (!publishedDate) {
        const timeLocator = page.locator('.post-date time');
        if (await timeLocator.count()) {
          const datetimeAttr = await timeLocator.getAttribute('datetime'); // "2025-12-17"
          if (datetimeAttr) {
            // Parse la fecha explícitamente como UTC para evitar problemas de zona horaria
            const [year, month, day] = datetimeAttr.split('-').map(Number);
            publishedDate = new Date(Date.UTC(year, month - 1, day));
            this.logger.debug(
              `📅 Fecha encontrada en tag <time>: ${datetimeAttr}`,
            );
          }
        }
      }

      // 3. INTENTO C: Parser manual de texto (El último recurso)
      if (!publishedDate) {
        this.logger.debug(
          `⚠️ Fecha exacta no encontrada. Intentando leer texto visual...`,
        );
        const visualDateText = await page.locator('.post-date').innerText();
        publishedDate = this.parseSpanishDate(visualDateText);
      }

      // Fallback final: "Hoy"
      if (!publishedDate || isNaN(publishedDate.getTime())) {
        publishedDate = new Date();
      }

      // Ajuste de Zona Horaria (Opcional pero recomendado para Argentina)
      // Como "2025-12-17" viene sin hora, JS lo toma como UTC 00:00.
      // En Argentina (GMT-3) eso podría caer en el día anterior a las 21:00.
      // Le sumamos 3 horas para asegurar que caiga en el día correcto.
      // publishedDate.setHours(publishedDate.getHours() + 3);

      return {
        origin: 'UADER',
        url: url,
        title: ogTitle || fallbackTitle,
        imageUrl: imageUrl || undefined,
        publishedAt: publishedDate,
      };
    } catch (e: unknown) {
      this.logger.warn(
        `Error leyendo detalle de ${url}: ${(e as Error).message}`,
      );
      return null;
    } finally {
      await page.close();
    }
  }
  private parseSpanishDate(text: string): Date | undefined {
    if (!text) return undefined;

    // Diccionario de meses
    const months: { [key: string]: number } = {
      ene: 0,
      feb: 1,
      mar: 2,
      abr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      ago: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dic: 11,
      enero: 0,
      febrero: 1,
      marzo: 2,
      abril: 3,
      mayo: 4,
      junio: 5,
      julio: 6,
      agosto: 7,
      septiembre: 8,
      octubre: 9,
      noviembre: 10,
      diciembre: 11,
    };

    try {
      // Limpiamos el texto: "12 Nov" -> ["12", "Nov"]
      const parts = text.trim().split(/[\s,]+/);

      // Asumimos formato "Día Mes" (común en blogs)
      if (parts.length >= 2) {
        const day = parseInt(parts[0], 10);
        const monthStr = parts[1].toLowerCase().slice(0, 3);
        const month = months[monthStr];

        // 1. Determinamos el año base (si no viene en el texto, usamos el actual)
        let year = new Date().getFullYear();
        if (parts.length > 2 && !isNaN(parseInt(parts[2]))) {
          year = parseInt(parts[2]);
        }

        if (!isNaN(day) && month !== undefined) {
          // 2. Creamos la fecha candidata
          const candidateDate = new Date(year, month, day);

          // 3. APLICAMOS LA LÓGICA DE AÑO NUEVO
          // Si la fecha candidata es mayor a "ahora" (ej: dice Dic y estamos en Feb),
          // significa que es del año pasado.
          if (candidateDate > new Date()) {
            candidateDate.setFullYear(year - 1);
          }

          return candidateDate;
        }
      }
    } catch (e: unknown) {
      this.logger.error(
        `No se pudo parsear fecha visual: "${text}", error ${(e as Error).message}`,
      );
    }
    return undefined;
  }

  private async getMetaContent(
    page: Page,
    property: string,
  ): Promise<string | null> {
    const element = page.locator(`meta[property="${property}"]`);
    if ((await element.count()) > 0) {
      return await element.getAttribute('content');
    }
    return null;
  }
}
