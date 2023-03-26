import { regEx } from '../../../util/regex';

export function extractPerlVersion(txt: string): string | null {
  const perlMatch = regEx(
    /^\s*requires\s+['"]perl['"],\s*['"]?v?(?<currentValue>[^'"]+)['"]?;\s*$/gm
  ).exec(txt);
  return perlMatch?.groups?.currentValue ?? null;
}
