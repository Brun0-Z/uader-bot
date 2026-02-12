import { Module } from '@nestjs/common';
import { DiscordService } from './discord.service';

@Module({
  providers: [DiscordService],
  exports: [DiscordService], // <--- IMPORTANTE: Exportar para que JobsModule lo pueda usar
})
export class DiscordModule {}
