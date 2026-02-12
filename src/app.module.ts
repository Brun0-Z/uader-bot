import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { JobsModule } from './jobs/jobs.module';

@Module({
  imports: [
    ScheduleModule.forRoot(), // Habilita los Cron Jobs
    JobsModule,
  ],
})
export class AppModule {}
