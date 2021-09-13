const semver = require('semver');
const shell = require('shelljs');

const GIT_MINIMUM_VERSION = '2.33.0';
function checkGitVersion() {
  try {
    const regex = /[\d.]+(?=)/g;
    let gitVersion = shell
      .exec('git --version', { silent: true })
      .stdout.toString();
    gitVersion = gitVersion.match(regex)[0];
    if (semver.lt(gitVersion, GIT_MINIMUM_VERSION)) {
      throw new Error(
        'Minimum Git version ' + GIT_MINIMUM_VERSION + ' is required'
      );
    }
    process.exit(0);
  } catch (err) {
    shell.echo('ERROR:', err.message);
    process.exit(1);
  }
}
checkGitVersion();
