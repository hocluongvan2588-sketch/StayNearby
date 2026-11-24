import { describe, expect, it } from 'vitest';
import { canTransitionBooking, type BookingStatus } from '@/modules/bookings';

describe('booking status transition matrix', () => {
  it('permits documented transitions from pending and confirmed', () => {
    expect(canTransitionBooking('pending', 'confirmed')).toBe(true);
    expect(canTransitionBooking('pending', 'declined')).toBe(true);
    expect(canTransitionBooking('pending', 'withdrawn')).toBe(true);
    expect(canTransitionBooking('pending', 'expired')).toBe(true);
    expect(canTransitionBooking('confirmed', 'cancelled')).toBe(true);
    expect(canTransitionBooking('confirmed', 'completed')).toBe(true);
  });

  it('rejects invalid shortcuts and transitions out of terminal states', () => {
    expect(canTransitionBooking('pending', 'completed')).toBe(false);
    expect(canTransitionBooking('confirmed', 'expired')).toBe(false);
    expect(canTransitionBooking('confirmed', 'declined')).toBe(false);

    const terminalStates: BookingStatus[] = [
      'declined',
      'withdrawn',
      'expired',
      'cancelled',
      'completed',
    ];
    const allStates: BookingStatus[] = [
      'pending',
      'confirmed',
      'declined',
      'withdrawn',
      'expired',
      'cancelled',
      'completed',
    ];

    for (const terminal of terminalStates) {
      for (const next of allStates) {
        expect(canTransitionBooking(terminal, next)).toBe(false);
      }
    }
  });
});
