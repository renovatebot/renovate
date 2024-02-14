// https://packaging.python.org/en/latest/specifications/name-normalization/
export function normalizeDepName(name: string): string {
  return name.replace(/[-_.]+/g, '-').toLowerCase();
}
