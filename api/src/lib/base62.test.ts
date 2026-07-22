import { encodeBase62 } from './base62';

describe('encodeBase62', () => {
  it('encodes known values correctly', () => {
    expect(encodeBase62(0)).toBe('0');
    expect(encodeBase62(61)).toBe('Z');
    expect(encodeBase62(62)).toBe('10');
  });

  it('produces no collisions across 100,000 values', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100000; i += 1) {
      const encoded = encodeBase62(i);
      expect(seen.has(encoded)).toBe(false);
      seen.add(encoded);
    }
  });
});
