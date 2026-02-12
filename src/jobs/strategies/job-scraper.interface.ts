// src/jobs/strategies/job-scraper.interface.ts

export interface ScrapedInternship {
  origin: string; // "UADER", "LINKEDIN"
  url: string; // Identificador único
  title: string;
  imageUrl?: string; // Opcional
  publishedAt?: Date; // Opcional
}

export interface JobScraperStrategy {
  name: string;
  scrape(): Promise<ScrapedInternship[]>;
}
