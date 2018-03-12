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
  const contentFields = [
    'content',
    'contents',
    'packageLockParsed',
    'yarnLockParsed',
  ];
  // eslint-disable-next-line array-callback-return
  return traverse(config).map(function scrub(val) {
    if (val && redactedFields.indexOf(this.key) !== -1) {
      this.update('***********');
    }
    if (val && templateFields.indexOf(this.key) !== -1) {
      this.update('[Template]');
    }
    if (val && contentFields.includes(this.key)) {
      this.update('[content]');
    }
  });
}
