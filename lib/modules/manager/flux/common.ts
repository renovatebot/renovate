import { regEx } from '../../../util/regex';

export const systemManifestRegex =
  '(^|\\/)flux-system\\/(?:.+\\/)?gotk-components\\.yaml$';

export function isSystemManifest(file: string): boolean {
  return regEx(systemManifestRegex).test(file);
}
