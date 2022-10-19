import * as template from '../../../../../util/template';
import type { BranchConfig } from '../../../../types';

export function getPrHeader(config: BranchConfig): string {
  if (!config.prHeader) {
    return '';
  }
  return template.compile(config.prHeader, config) + '\n\n';
}
