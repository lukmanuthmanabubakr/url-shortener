import { generateKey, fillPoolTo, issueKey, KEY_LENGTH, POOL_KEY } from './keyPool';
import { redis } from '../lib/redis';

describe('keyPool', () => {
  beforeEach(async () => {
    await redis.del(POOL_KEY);
  });

  afterAll(async () => {
    await redis.del(POOL_KEY);
    await redis.quit();
  });

  describe('generateKey', () => {
    it('produces a key of exactly KEY_LENGTH characters', () => {
      const key = generateKey();
      expect(key).toHaveLength(KEY_LENGTH);
    });

    it('produces unique keys across 10,000 calls', () => {
      const seen = new Set<string>();
      for (let i = 0; i < 10_000; i += 1) {
        const key = generateKey();
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
      expect(seen.size).toBe(10_000);
    });

    it('uses only valid Base62 characters', () => {
      const key = generateKey();
      expect(key).toMatch(/^[0-9a-zA-Z]+$/);
    });
  });

  describe('fillPoolTo', () => {
    it('fills an empty pool to the target count', async () => {
      await fillPoolTo(100);
      const count = await redis.scard(POOL_KEY);
      expect(count).toBe(100);
    });

    it('does not overfill when called with a count below current depth', async () => {
      await fillPoolTo(50);
      await fillPoolTo(30);
      const count = await redis.scard(POOL_KEY);
      expect(count).toBe(50);
    });

    it('tops up an existing pool to the new target', async () => {
      await fillPoolTo(50);
      await fillPoolTo(200);
      const count = await redis.scard(POOL_KEY);
      expect(count).toBe(200);
    });

    it('all generated keys are exactly KEY_LENGTH chars', async () => {
      await fillPoolTo(100);
      const keys = await redis.smembers(POOL_KEY);
      keys.forEach((k) => expect(k).toHaveLength(KEY_LENGTH));
    });
  });

  describe('issueKey', () => {
    it('returns a key from the pool and removes it', async () => {
      await fillPoolTo(10);
      const before = await redis.scard(POOL_KEY);
      const key = await issueKey();

      expect(key).toHaveLength(KEY_LENGTH);
      const after = await redis.scard(POOL_KEY);
      expect(after).toBe(before - 1);

      const stillInPool = await redis.sismember(POOL_KEY, key);
      expect(stillInPool).toBe(0);
    });

    it('issues unique keys on consecutive calls', async () => {
      await fillPoolTo(20);
      const keys = await Promise.all(Array.from({ length: 10 }, () => issueKey()));
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(10);
    });

    it('falls back to inline generation when pool is empty', async () => {
      const key = await issueKey();
      expect(key).toHaveLength(KEY_LENGTH);
      expect(key).toMatch(/^[0-9a-zA-Z]+$/);
    });
  });
});
