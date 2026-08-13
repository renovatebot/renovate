import type { RenovateOptions } from '../types.ts';

type EnvNameOption = Partial<RenovateOptions> & Pick<RenovateOptions, 'name'>;

export function getEnvName(option: EnvNameOption): string {
  if (option.env === false) {
    return '';
  }
  if (option.env) {
    return option.env;
  }
  const nameWithUnderscores = option.name.replace(/([A-Z])/g, '_$1');
  return `RENOVATE_${nameWithUnderscores.toUpperCase()}`;
}
