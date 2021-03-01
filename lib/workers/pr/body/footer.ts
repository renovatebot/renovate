import * as template from '../../../util/template';
import { BranchConfig } from '../../common';

/* c8 ignore next */
export function getPrFooter(config: BranchConfig): string {
  if (config.prFooter) {
    return '\n---\n\n' + template.compile(config.prFooter, config);
  }
  return '';
}
