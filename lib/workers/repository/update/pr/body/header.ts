import type { RenovateConfig } from '../../../../../config/types.ts';
import * as template from '../../../../../util/template/index.ts';
import type { BranchConfig } from '../../../../types.ts';

export function getPrHeader(config: RenovateConfig | BranchConfig): string {
  if (!config.prHeader) {
    return '';
  }
  return `${template.compile(config.prHeader, config)}\n\n`;
}
