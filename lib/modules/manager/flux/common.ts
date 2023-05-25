import { regEx } from '../../../util/regex';

export const systemManifestRegex =
  '(^|/)flux-system/(?:.+/)?gotk-components\\.ya?ml$';

export function isSystemManifest(file: string): boolean {
  return regEx(systemManifestRegex).test(file);
}
