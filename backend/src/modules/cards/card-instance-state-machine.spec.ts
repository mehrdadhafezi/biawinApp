import { ConflictException } from '@nestjs/common';
import { assertCardInstanceTransition } from './card-instance-state-machine';

describe('card-instance-state-machine', () => {
  it('allows CREATED -> PURCHASED', () => {
    expect(() =>
      assertCardInstanceTransition('CREATED', 'PURCHASED'),
    ).not.toThrow();
  });

  it('allows PURCHASED -> ACTIVE', () => {
    expect(() =>
      assertCardInstanceTransition('PURCHASED', 'ACTIVE'),
    ).not.toThrow();
  });

  it('allows ACTIVE -> PARTIALLY_USED', () => {
    expect(() =>
      assertCardInstanceTransition('ACTIVE', 'PARTIALLY_USED'),
    ).not.toThrow();
  });

  it('allows PARTIALLY_USED -> USED', () => {
    expect(() =>
      assertCardInstanceTransition('PARTIALLY_USED', 'USED'),
    ).not.toThrow();
  });

  it('allows ACTIVE -> CANCELLED', () => {
    expect(() =>
      assertCardInstanceTransition('ACTIVE', 'CANCELLED'),
    ).not.toThrow();
  });

  it('rejects skipping straight from CREATED to ACTIVE', () => {
    expect(() => assertCardInstanceTransition('CREATED', 'ACTIVE')).toThrow(
      ConflictException,
    );
  });

  it('rejects any transition out of a terminal USED state', () => {
    expect(() => assertCardInstanceTransition('USED', 'ACTIVE')).toThrow(
      ConflictException,
    );
  });

  it('rejects any transition out of a terminal EXPIRED state', () => {
    expect(() => assertCardInstanceTransition('EXPIRED', 'ACTIVE')).toThrow(
      ConflictException,
    );
  });

  it('rejects any transition out of a terminal CANCELLED state', () => {
    expect(() => assertCardInstanceTransition('CANCELLED', 'ACTIVE')).toThrow(
      ConflictException,
    );
  });

  it('rejects reviving a used card back to created', () => {
    expect(() => assertCardInstanceTransition('USED', 'CREATED')).toThrow(
      ConflictException,
    );
  });
});
