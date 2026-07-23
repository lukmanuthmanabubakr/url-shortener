import { randomInt } from 'crypto';
import { redis } from '../lib/redis';
import { CHARSET } from '../lib/base62';

// Redis set that holds the pre-generated, unused short keys.
export const POOL_KEY = 'key_pool';

// Every issued key is a fixed-length random string over the Base62 charset.
// 62^6 gives ~56.8 billion possible keys, so random collisions are rare and
// the SADD set semantics silently drop any that do occur.
export const KEY_LENGTH = 6;

// Steady-state pool size the monitor fills to on startup and after a refill.
export const POOL_TARGET = 1000;

// When the pool drops below this depth, the monitor tops it back up.
export const POOL_LOW_WATERMARK = 200;

// How many keys a single refill pass adds before re-checking the count.
export const REFILL_BATCH = 500;

// Pool monitor cadence.
export const MONITOR_INTERVAL_MS = 30_000;

let monitorTimer: NodeJS.Timeout | null = null;

// Generates one random KEY_LENGTH Base62 string. randomInt is drawn from a CSPRNG
// and is unbiased across the charset because 62 divides the sampling range evenly
// through rejection inside randomInt.
export function generateKey(): string {
  let key = '';
  for (let i = 0; i < KEY_LENGTH; i += 1) {
    key += CHARSET[randomInt(CHARSET.length)];
  }
  return key;
}

// Adds random keys until the set holds at least `target` members. Because SADD
// into a set is idempotent, colliding keys do not inflate the count, so we loop
// on SCARD rather than trusting a fixed number of adds.
export async function fillPoolTo(target: number): Promise<number> {
  let count = await redis.scard(POOL_KEY);

  // Each pass depends on the prior SCARD: collisions mean an SADD may add fewer
  // than requested, so the top-up must be sequential, not parallel.
  /* eslint-disable no-await-in-loop */
  while (count < target) {
    const deficit = target - count;
    const batch = Array.from({ length: deficit }, () => generateKey());
    await redis.sadd(POOL_KEY, ...batch);
    count = await redis.scard(POOL_KEY);
  }
  /* eslint-enable no-await-in-loop */

  return count;
}

// Issues one key atomically. SPOP removes and returns a member in a single
// operation, so two concurrent callers can never receive the same key. Falls
// back to an inline generated key if the pool is momentarily empty.
export async function issueKey(): Promise<string> {
  const key = await redis.spop(POOL_KEY);
  return key ?? generateKey();
}

// Fills the pool to target immediately, then tops it up on an interval whenever
// depth falls below the low watermark. Safe to call once at startup.
export async function startPoolMonitor(): Promise<void> {
  await fillPoolTo(POOL_TARGET);

  if (monitorTimer) return;

  monitorTimer = setInterval(async () => {
    try {
      const depth = await redis.scard(POOL_KEY);
      if (depth < POOL_LOW_WATERMARK) {
        await fillPoolTo(depth + REFILL_BATCH);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Key pool monitor error:', (err as Error).message);
    }
  }, MONITOR_INTERVAL_MS);

  // Do not keep the event loop alive solely for the pool monitor.
  monitorTimer.unref();
}

// Stops the monitor. Used for graceful shutdown and test isolation.
export function stopPoolMonitor(): void {
  if (monitorTimer) {
    clearInterval(monitorTimer);
    monitorTimer = null;
  }
}
