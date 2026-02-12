import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UaderStrategy } from './strategies/uader.strategy';
import {
  JobScraperStrategy,
  ScrapedInternship,
} from './strategies/job-scraper.interface';
import { DiscordService } from '../discord/discord.service';

@Injectable()
export class JobsService implements OnModuleInit {
  // <--- Implementar la interfaz
  private readonly logger = new Logger(JobsService.name);
  private strategies: JobScraperStrategy[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly uaderStrategy: UaderStrategy,
    private readonly discordService: DiscordService,
  ) {
    this.strategies = [this.uaderStrategy];
  }

  // ESTE ES EL GATILLO QUE NOS FALTA
  async onModuleInit() {
    this.logger.log('🚀 Disparando scraping manual al inicio...');
    await this.runScrapingCycle();
  }

  /**
   * Ejecuta el ciclo de scraping y retorna SOLO las pasantías nuevas guardadas.
   */
  async runScrapingCycle(): Promise<ScrapedInternship[]> {
    this.logger.log('Iniciando ciclo de scraping general...');
    const newInternships: ScrapedInternship[] = [];

    for (const strategy of this.strategies) {
      this.logger.log(`Ejecutando estrategia: ${strategy.name}`);

      // 1. Obtener datos crudos de la web
      const scrapedData = await strategy.scrape();

      // 2. Filtrar y Guardar
      for (const item of scrapedData) {
        const saved = await this.saveIfNew(item);
        if (saved) {
          newInternships.push(item);

          await this.discordService.sendNotification({
            title: item.title,
            url: item.url,
            origin: item.origin,
            imageUrl: item.imageUrl,
          });
        }
      }
    }

    this.logger.log(
      `Ciclo terminado. ${newInternships.length} nuevas oportunidades encontradas.`,
    );
    return newInternships;
  }

  /**
   * Verifica existencia en BD y guarda si es nueva.
   * Retorna true si se guardó, false si ya existía.
   */
  private async saveIfNew(item: ScrapedInternship): Promise<boolean> {
    try {
      // Verificamos por URL (nuestra huella digital única)
      const exists = await this.prisma.internship.findUnique({
        where: { url: item.url },
      });

      if (exists) {
        return false;
      }

      // Si no existe, creamos
      await this.prisma.internship.create({
        data: {
          origin: item.origin,
          title: item.title,
          url: item.url,
          imageUrl: item.imageUrl,
          publishedAt: item.publishedAt,
          foundAt: new Date(),
          isPublished: true, // Aún no se envió a Discord
        },
      });

      this.logger.log(`Nueva pasantía guardada en BD: ${item.title}`);
      return true;
    } catch (error: unknown) {
      this.logger.error(
        `Error guardando pasantía ${item.url}: ${(error as Error).message}`,
      );
      return false;
    }
  }
}
