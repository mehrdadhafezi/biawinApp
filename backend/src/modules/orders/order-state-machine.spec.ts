import { ConflictException } from '@nestjs/common';
import { assertOrderTransition } from './order-state-machine';

describe('order-state-machine', () => {
  it('allows pending -> processing', () => {
    expect(() => assertOrderTransition('pending', 'processing')).not.toThrow();
  });

  it('allows pending -> cancelled', () => {
    expect(() => assertOrderTransition('pending', 'cancelled')).not.toThrow();
  });

  it('rejects skipping straight from pending to delivered', () => {
    expect(() => assertOrderTransition('pending', 'delivered')).toThrow(
      ConflictException,
    );
  });

  it('rejects any transition out of a terminal delivered state', () => {
    expect(() => assertOrderTransition('delivered', 'pending')).toThrow(
      ConflictException,
    );
  });

  it('rejects any transition out of a terminal cancelled state', () => {
    expect(() => assertOrderTransition('cancelled', 'pending')).toThrow(
      ConflictException,
    );
  });

  it('rejects reviving a paid order back to pending', () => {
    expect(() => assertOrderTransition('paid', 'pending')).toThrow(
      ConflictException,
    );
  });
});
