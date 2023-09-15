import { regEx } from '../../../../../util/regex';

export function parseDepName(depType: string, key: string): string {
  if (depType !== 'resolutions') {
    return key;
  }

  const [, depName] = regEx(/((?:@[^/]+\/)?[^/@]+)$/).exec(key) ?? [];
  return depName;
}
