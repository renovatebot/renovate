const handlebars = require('handlebars');

module.exports = {
  transform,
};

function transform(template, params) {
  const compiler = handlebars.compile(template);
  return compiler(params);
}
