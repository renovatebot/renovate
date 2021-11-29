let prev: string;

// this does not work as intended
// see https://jestjs.io/docs/en/configuration#snapshotserializers-arraystring
export function print(val: string): string {
  return JSON.stringify(val);
}
export function test(val: string): boolean {
  if (['prBody', 'prTitle'].some((str) => str === prev)) {
    return typeof val === 'string' && val.includes('\n');
  }
  prev = val;
  return false;
}
