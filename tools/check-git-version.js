const shell = require('shelljs');

function checkGitVersion() {
  try {
        const regex = /[\d]+(?=.)/g;
        const gitVersion = shell
      .exec('git --version', { silent: true })
      .stdout.toString();
    
   const [major, minor, revision] = gitVersion.match(regex);
    const [reqMajor, reqMinor, reqRevision] = GIT_MINIMUM_VERSION.match(regex);
    if (major < reqMajor) {
      throw new Error('Minimum git version 2.33.0 is required');
    } else if (major === reqMajor) {
      if (minor < reqMinor) {
        throw new Error('Minimum git version 2.33.0 is required');
      } else if (minor === reqMinor) {
        if (revision < reqRevision) {
          throw new Error('Minimum git version 2.33.0 is required');
        }
      }
    }
    process.exit(0);
    } else {
      throw new Error('Minimum git version 2.33.0 is required');
    }
  } catch (err) {
    shell.echo('ERROR:', err.message);
    process.exit(1);
  }
}
checkGitVersion();
