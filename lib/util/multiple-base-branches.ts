import type { RenovateConfig } from '../config/types';
import { isRegexMatch } from './string-match';

let multipleBaseBranches: boolean;

export function setMultipleBaseBranches(config: RenovateConfig): void {
  multipleBaseBranches = false;
  if (config.baseBranches) {
    if (config.baseBranches.length > 1) {
      multipleBaseBranches = true;
    } else {
      multipleBaseBranches = config.baseBranches.some(isRegexMatch);
    }
  }
}

export function expectMultipleBaseBranches(): boolean {
  return multipleBaseBranches;
}
