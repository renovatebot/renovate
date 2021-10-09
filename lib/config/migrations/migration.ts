import type { RenovateConfig } from '../types';

export interface Migration {
  run(config: RenovateConfig): RenovateConfig;
}
