import type { SkipReason } from "../../../types/skip-reason";

export interface PuppetfileModule {
  name?: string;
  version?: string;
  tags?: Map<string, string>;
  skipReasons?: SkipReason[];
}

export type PuppetForgeUrl = string;
export type Puppetfile = Map<PuppetForgeUrl, PuppetfileModule[]>;
