export function maskToken(str?: string): string {
  return str
    ? [str.substring(0, 2), '*'.repeat(str.length - 4), str.slice(-2)].join('')
    : '';
}
