import handlebars from 'handlebars';
import { PrBodyConfig } from './common';

// istanbul ignore next
export function getPrFooter(config: PrBodyConfig): string {
  if (config.global && config.global.prFooter) {
    return '\n---\n\n' + handlebars.compile(config.global.prFooter)(config);
  }
  return '';
}
