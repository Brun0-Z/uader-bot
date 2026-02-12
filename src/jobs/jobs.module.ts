import { Module } from '@nestjs/common';
import { JobsService } from './jobs.services';
import { UaderStrategy } from './strategies/uader.strategy';
import { PrismaService } from '../database/prisma.service';
import { DiscordModule } from 'src/discord/discord.module';

@Module({
  imports: [DiscordModule],
  providers: [
    JobsService, // El Orquestador
    UaderStrategy, // La Estrategia
    PrismaService, // La Base de Datos
  ],
  exports: [JobsService], // Exportamos el servicio para usarlo en el Cron después
})
export class JobsModule {}
