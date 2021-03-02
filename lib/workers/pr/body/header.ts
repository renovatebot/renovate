import * as template from '../../../util/template';
import type { BranchConfig } from '../../types';

/* c8 ignore next */
export function getPrHeader(config: BranchConfig): string {
  if (!config.prHeader) {
    return '';
  }
  return template.compile(config.prHeader, config) + '\n\n';
}
