import type { RenovateConfig } from '../../config/types';

export interface Migration {
  run(config: RenovateConfig): RenovateConfig;
}
