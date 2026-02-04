import type { RenovateOptions } from '../../../../config/types.ts';

export type ParseConfigOptions = Partial<RenovateOptions> &
  Pick<RenovateOptions, 'name'>;
