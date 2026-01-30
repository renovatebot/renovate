import * as template from '../../../../../util/template/index.ts';
import type { BranchConfig } from '../../../../types.ts';

export function getPrHeader(config: BranchConfig): string {
  if (!config.prHeader) {
    return '';
  }
  return template.compile(config.prHeader, config) + '\n\n';
}
