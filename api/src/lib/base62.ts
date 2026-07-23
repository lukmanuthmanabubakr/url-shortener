export const CHARSET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function encodeBase62(num: number): string {
  if (num === 0) return CHARSET[0];
  let result = '';
  let n = num;
  while (n > 0) {
    result = CHARSET[n % 62] + result;
    n = Math.floor(n / 62);
  }
  return result;
}
