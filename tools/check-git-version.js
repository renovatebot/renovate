const shell = require('shelljs');

const GIT_MINIMUM_VERSION = '2.33.0';
function checkGitVersion() {
  try {
    const regex = /[\d]+(?=.)/g;
    const gitVersion = shell
      .exec('git --version', { silent: true })
      .stdout.toString();
    const GIT_VERSION_NOT_COMPATIBLE_ERROR = new Error(
      'Minimum git version 2.33.0 is required'
    );
    const [major, minor, revision] = gitVersion.match(regex);
    const [reqMajor, reqMinor, reqRevision] = GIT_MINIMUM_VERSION.match(regex);
    if (major < reqMajor) {
      throw GIT_VERSION_NOT_COMPATIBLE_ERROR;
    } else if (major === reqMajor) {
      if (minor < reqMinor) {
        throw GIT_VERSION_NOT_COMPATIBLE_ERROR;
      } else if (minor === reqMinor) {
        if (revision < reqRevision) {
          throw GIT_VERSION_NOT_COMPATIBLE_ERROR;
        }
      }
    }
    process.exit(0);
  } catch (err) {
    shell.echo('ERROR:', err.message);
    process.exit(1);
  }
}
checkGitVersion();
