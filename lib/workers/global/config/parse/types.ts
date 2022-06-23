import type { RenovateOptions } from '../../../../config/types';

export type ParseConfigOptions = Partial<RenovateOptions> &
  Pick<RenovateOptions, 'name'>;
