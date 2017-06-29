const traverse = require('traverse');

module.exports = configSerializer;

function configSerializer(config) {
  const redactedFields = ['token', 'githubAppKey'];
  const functionFields = ['api', 'logger'];
  // eslint-disable-next-line array-callback-return
  return traverse(config).map(function scrub(val) {
    if (val && redactedFields.indexOf(this.key) !== -1) {
      this.update('***********');
    }
    if (val && functionFields.indexOf(this.key) !== -1) {
      this.update('[Function]');
    }
  });
}
