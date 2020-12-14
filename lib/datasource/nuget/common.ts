export const id = 'nuget';

const buildMetaRe = /\+.+$/g;

export function removeBuildMeta(version: string): string {
  return version?.replace(buildMetaRe, '');
}
