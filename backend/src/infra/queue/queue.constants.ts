/** BullMQ queue names — one queue per async job family (see docs/01-architecture.md §2.2). */
export const QUEUE = {
  SMS: 'sms',
  PUSH_NOTIFICATION: 'push-notification',
  EMAIL: 'email',
  FINANCIAL_EVENTS: 'financial-events',
} as const;

export type QueueName = (typeof QUEUE)[keyof typeof QUEUE];
