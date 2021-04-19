const ONE_MINUTE_MS = 60 * 1000;
const ONE_DAY_MS = 24 * 60 * ONE_MINUTE_MS;

export function getElapsedDays(timestamp: string): number {
  return Math.floor(
    (new Date().getTime() - new Date(timestamp).getTime()) / ONE_DAY_MS
  );
}

export function getElapsedMinutes(date: Date): number {
  return Math.floor((new Date().getTime() - date.getTime()) / ONE_MINUTE_MS);
}
