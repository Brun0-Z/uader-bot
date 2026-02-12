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
  private readonly KEYWORDS = ['pasantia', 'pasantía', 'rentada'];

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
      const ogImage = await this.getMetaContent(page, 'og:image');

      // 1. INTENTO A: Metadato Estándar (La opción limpia)
      let publishedDate: Date | undefined;
      const metaDate = await this.getMetaContent(
        page,
        'article:published_time',
      );

      if (metaDate) {
        publishedDate = new Date(metaDate);
      } else {
        // 2. INTENTO B: Leer el div visual (La opción sucia)
        this.logger.debug(
          `⚠️ Metadato de fecha no encontrado en ${url}. Intentando leer .post-date...`,
        );
        const visualDateText = await page.locator('.post-date').innerText(); // Ej: "12 Nov"
        publishedDate = this.parseSpanishDate(visualDateText);
      }

      // Si aún así falla, usamos la fecha actual como último recurso
      if (!publishedDate || isNaN(publishedDate.getTime())) {
        publishedDate = new Date();
      }

      return {
        origin: 'UADER',
        url: url,
        title: ogTitle || fallbackTitle,
        imageUrl: ogImage || undefined,
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

  // Helper para convertir "12 Nov" o "12 Noviembre" a Objeto Date
  private parseSpanishDate(text: string): Date | undefined {
    if (!text) return undefined;

    // Diccionario de meses (UADER suele usar abreviaturas o nombres completos)
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
        const monthStr = parts[1].toLowerCase().slice(0, 3); // Tomamos las primeras 3 letras
        const month = months[monthStr];

        // Si no hay año, asumimos el año actual
        // (Ojo: Si estamos en Enero y la noticia es de Dic, esto podría fallar,
        // pero para pasantías recientes sirve).
        const year =
          parts.length > 2 && !isNaN(parseInt(parts[2]))
            ? parseInt(parts[2])
            : new Date().getFullYear();

        if (!isNaN(day) && month !== undefined) {
          return new Date(year, month, day);
        }
        const date = new Date(year, month, day);
        if (date > new Date()) {
          date.setFullYear(year - 1);
        }
        return date;
      }
    } catch (e: unknown) {
      this.logger.error(
        `No se pudo parsear fecha visual: "${text}, error ${(e as Error).message}"`,
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
