const handlebars = require('handlebars');

// istanbul ignore next
export function getPrBanner(config) {
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
