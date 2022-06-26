import * as template from '../../../../../util/template';
import type { NarrowedBranchConfig } from '../../../../types';

export function getPrFooter(config: NarrowedBranchConfig): string {
  if (config.prFooter) {
    return '\n---\n\n' + template.compile(config.prFooter, config);
  }
  return '';
}
