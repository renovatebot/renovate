import { regEx } from '../../../util/regex';

export const systemManifestFileNameRegex = '(?:^|/)gotk-components\\.ya?ml$';

export const systemManifestHeaderRegex =
  '#\\s*Flux\\s+Version:\\s*(\\S+)(?:\\s*#\\s*Components:\\s*([A-Za-z,-]+))?';

export function isSystemManifest(file: string): boolean {
  return regEx(systemManifestFileNameRegex).test(file);
}
