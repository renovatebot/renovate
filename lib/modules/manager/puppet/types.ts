import type { SkipReason } from '../../../types/skip-reason';

export interface PuppetfileModule {
  name?: string;
  version?: string;
  tags?: Map<string, string>;
  skipReason?: SkipReason;
}

export type PuppetForgeUrl = string | undefined;
export type Puppetfile = Map<PuppetForgeUrl, PuppetfileModule[]>;
