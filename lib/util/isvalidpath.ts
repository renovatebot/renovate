const validFilePathRegex = new RegExp(/^(\/?[a-z0-9.]+)+$/);
export function isValidPath(s: string): boolean {
  return validFilePathRegex.test(s);
}
