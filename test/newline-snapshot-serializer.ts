let prev: string;

export function print(val: any) {
  return JSON.stringify(val);
}
export function test(val: any) {
  if (['prBody', 'prTitle'].some(str => str === prev)) {
    return typeof val === 'string' && val.includes('\n');
  }
  prev = val;
  return false;
}
