import { describe, expect, it } from 'vitest';
import { calculateEquivalents, calculateEstimatedScrollDistance } from '@src/receipts/equivalent-engine';
import { DEFAULT_EQUIVALENT_RATES } from '@src/utils/constants';

describe('equivalent engine', () => {
  it('calculates reading pages from active minutes', () => {
    const result = calculateEquivalents(3600, DEFAULT_EQUIVALENT_RATES);
    const reading = result.find((r) => r.id === 'reading');
    expect(reading?.value).toBe('27');
    expect(reading?.unit).toBe('PAGES');
  });

  it('rounds walking steps to nearest ten', () => {
    const result = calculateEquivalents(600, DEFAULT_EQUIVALENT_RATES);
    const walking = result.find((r) => r.id === 'walking');
    expect(walking?.value).toBe('900');
  });

  it('labels scroll distance as estimated meters', () => {
    expect(calculateEstimatedScrollDistance(10, 12)).toBe('120 M');
  });
});
