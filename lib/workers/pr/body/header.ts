import * as template from '../../../util/template';
import { BranchConfig } from '../../common';

// istanbul ignore next
export function getPrHeader(config: BranchConfig): string {
  if (!config.prHeader) {
    return '';
  }
  return template.compile(config.prHeader, config) + '\n\n';
}
