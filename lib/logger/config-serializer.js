const traverse = require('traverse');

module.exports = configSerializer;

function configSerializer(config) {
  const redactedFields = [
    'authorization',
    'token',
    'githubAppKey',
    'npmToken',
    'npmrc',
    'yarnrc',
    'privateKey',
    'gitPrivateKey',
    'forkToken',
  ];
  const templateFields = ['commitMessage', 'prTitle', 'prBody'];
  // eslint-disable-next-line array-callback-return
  return traverse(config).map(function scrub(val) {
    if (val && redactedFields.indexOf(this.key) !== -1) {
      this.update('***********');
    }
    if (val && templateFields.indexOf(this.key) !== -1) {
      this.update('[Template]');
    }
    if (this.key === 'content' || this.key === 'contents') {
      this.update('[content]');
    }
  });
}
