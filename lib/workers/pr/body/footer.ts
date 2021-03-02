import * as template from '../../../util/template';
import type { BranchConfig } from '../../types';

// istanbul ignore next
export function getPrFooter(config: BranchConfig): string {
  if (config.prFooter) {
    return '\n---\n\n' + template.compile(config.prFooter, config);
  }
  return '';
}
