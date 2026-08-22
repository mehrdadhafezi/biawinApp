import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { QUEUE } from '../queue.constants';

export interface PushNotificationJobData {
  userId: string;
  title: string;
  body: string;
}

/** Foundation stub — replace with FCM/APNs (or a push aggregator) at Feature stage. */
@Processor(QUEUE.PUSH_NOTIFICATION)
export class PushNotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(PushNotificationProcessor.name);

  process(job: Job<PushNotificationJobData>): Promise<void> {
    this.logger.log(
      `[stub] would push to user ${job.data.userId}: "${job.data.title}"`,
    );
    return Promise.resolve();
  }
}
