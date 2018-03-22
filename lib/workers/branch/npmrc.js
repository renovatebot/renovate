const ini = require('ini');

module.exports = { validateNpmrc };

function validateNpmrc(input) {
  const npmrc = ini.parse(input);
  const regExp = /[0-9]|['"`+:.?!=|,$&@()^*[\]\s]/;
  const errors = [];
  for (const key in npmrc) {
    if (Object.prototype.hasOwnProperty.call(npmrc, key)) {
      if (regExp.test(key)) {
        errors.push(`Invalid npmrc config property: \`${key}\``);
      }
    }
  }
  return errors;
}
