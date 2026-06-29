import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn (className merge)', () => {
  it('should merge classes', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });

  it('should handle conditional classes', () => {
    expect(cn('base', false && 'hidden', 'extra')).toBe('base extra');
  });

  it('should handle undefined', () => {
    expect(cn('a', undefined, 'b', null)).toBe('a b');
  });
});
