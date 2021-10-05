import { regEx } from '../../util/regex';

export const id = 'nuget';

const buildMetaRe = regEx(/\+.+$/g);

export function removeBuildMeta(version: string): string {
  return version?.replace(buildMetaRe, '');
}
