import handlebars from 'handlebars';
import { BranchConfig } from '../../common';

// istanbul ignore next
export function getPrFooter(config: BranchConfig): string {
  if (config.global && config.global.prFooter) {
    return '\n---\n\n' + handlebars.compile(config.global.prFooter)(config);
  }
  return '';
}
