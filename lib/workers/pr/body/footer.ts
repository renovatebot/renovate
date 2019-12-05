import { compile } from 'handlebars';
import { PrBodyConfig } from './common';

// istanbul ignore next
export function getPrFooter(config: PrBodyConfig): string {
  if (config.global && config.global.prFooter) {
    return '\n---\n\n' + compile(config.global.prFooter)(config);
  }
  return '';
}
