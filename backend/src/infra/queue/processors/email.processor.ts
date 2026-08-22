import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { QUEUE } from '../queue.constants';

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
}

/** Foundation stub — replace with a real transactional-email provider at Feature stage. */
@Processor(QUEUE.EMAIL)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  process(job: Job<EmailJobData>): Promise<void> {
    this.logger.log(`[stub] would email ${job.data.to}: "${job.data.subject}"`);
    return Promise.resolve();
  }
}
