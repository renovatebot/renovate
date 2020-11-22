export const id = 'nuget';

const buildMetaRe = /\+.+$/g;

export function replaceBuildMeta(version: string): string {
  return version?.replace(buildMetaRe, '');
}
