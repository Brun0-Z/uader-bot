import { Injectable, Logger } from '@nestjs/common';
import { WebhookClient, EmbedBuilder } from 'discord.js';

@Injectable()
export class DiscordService {
  private readonly logger = new Logger(DiscordService.name);
  private webhookClient: WebhookClient;
  private roleId: string | undefined;

  constructor() {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    this.roleId = process.env.DISCORD_ROLE_ID;
    if (!webhookUrl) {
      this.logger.warn(
        '⚠️ DISCORD_WEBHOOK_URL no está definido en .env. Las notificaciones fallarán.',
      );
      return;
    }
    this.webhookClient = new WebhookClient({ url: webhookUrl });
  }

  async sendNotification(internship: {
    title: string;
    url: string;
    imageUrl?: string;
    origin: string;
  }): Promise<boolean> {
    if (!this.webhookClient) return false;

    try {
      // Diseño de la "Tarjeta" (Embed)
      const embed = new EmbedBuilder()
        .setTitle(`🎓 Nueva Oportunidad: ${internship.origin}`)
        .setDescription(`**${internship.title}**`)
        .setURL(internship.url)
        .setColor(0x00b0f4) // Azul tipo UADER
        .setTimestamp()
        .setFooter({ text: 'Bot de Pasantías • UADER FCyT' });

      if (internship.imageUrl) {
        embed.setImage(internship.imageUrl);
      }

      const mentionText = this.roleId
        ? `<@&${this.roleId}>`
        : '¡Atención estudiantes!';

      await this.webhookClient.send({
        content: `${mentionText} 📢 **¡Atención estudiantes!** Se ha detectado una nueva pasantía.`,
        embeds: [embed],
      });

      this.logger.log(`📨 Notificación enviada a Discord: ${internship.title}`);
      return true;
    } catch (error) {
      this.logger.error(`Error enviando a Discord: ${error}`);
      return false;
    }
  }
}
