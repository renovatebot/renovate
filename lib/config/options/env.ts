import type { RenovateOptions } from '../types.ts';

type EnvNameOption = Partial<RenovateOptions> & Pick<RenovateOptions, 'name'>;

export function getEnvName(option: EnvNameOption): string {
  if (option.env === false) {
    return '';
  }
  if (option.env) {
    return option.env;
  }
  const nameWithUnderscores = option.name.replace(
    /(?<upper>[A-Z])/g,
    '_$<upper>',
  );
  return `RENOVATE_${nameWithUnderscores.toUpperCase()}`;
}
