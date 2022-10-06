import type { SkipReason } from '../../../types';

export interface PuppetfileModule {
  name?: string;
  version?: string;
  tags?: Map<string, string>;
  skipReason?: SkipReason;
}
