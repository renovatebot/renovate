import type { RenovateConfig } from '../../../../../config/types.ts';
import * as template from '../../../../../util/template/index.ts';
import type { BranchConfig } from '../../../../types.ts';

export function getPrFooter(config: RenovateConfig | BranchConfig): string {
  if (config.prFooter) {
    return `\n---\n\n${template.safeCompile(config.prFooter, config)}`;
  }
  return '';
}
