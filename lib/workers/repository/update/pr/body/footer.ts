import * as template from '../../../../../util/template';
import type { BranchConfig } from '../../../../types';

export function getPrFooter(config: BranchConfig): string {
  if (config.prFooter) {
    return '\n---\n\n' + template.compile(config.prFooter, config);
  }
  return '';
}
