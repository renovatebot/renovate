export function maskToken(str?: string): string {
  return str
    ? [
        str.substring(0, 2),
        new Array(str.length - 3).join('*'),
        str.slice(-2),
      ].join('')
    : '';
}
