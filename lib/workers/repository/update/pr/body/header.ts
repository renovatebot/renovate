import * as template from '../../../../../util/template';
import type { NarrowedBranchConfig } from '../../../../types';

export function getPrHeader(config: NarrowedBranchConfig): string {
  if (!config.prHeader) {
    return '';
  }
  return template.compile(config.prHeader, config) + '\n\n';
}
