const handlebars = require('handlebars');

// istanbul ignore next
export function getPrFooter(config) {
  if (config.global && config.global.prFooter) {
    return '\n---\n\n' + handlebars.compile(config.global.prFooter)(config);
  }
  return '';
}
