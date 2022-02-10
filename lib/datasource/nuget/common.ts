import { regEx } from '../../util/regex';

const buildMetaRe = regEx(/\+.+$/g);

export function removeBuildMeta(version: string): string {
  return version?.replace(buildMetaRe, '');
}
