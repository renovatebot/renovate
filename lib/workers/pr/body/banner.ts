import handlebars from 'handlebars';
import { PrBodyConfig } from './common';

// istanbul ignore next
export function getPrBanner(config: PrBodyConfig): string {
  if (config.global && config.global.prBanner) {
    return handlebars.compile(config.global.prBanner)(config) + '\n\n';
  }
  if (config.isGroup) {
    return ''; // TODO: why?
  }
  if (!config.prBanner) {
    return '';
  }
  return handlebars.compile(config.prBanner)(config) + '\n\n';
}
