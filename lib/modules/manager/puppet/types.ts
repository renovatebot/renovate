import type { SkipReason } from '../../../types/index.ts';

export interface PuppetfileModule {
  name?: string;
  version?: string;
  tags?: Map<string, string>;
  skipReason?: SkipReason;
}
