const shell = require('shelljs');

function checkGitVersion() {
  try {
    const gitVersion = shell
      .exec('git --version', { silent: true })
      .stdout.toString()
      .slice(12)
      .split('.');
    if (
      parseInt(gitVersion[0], 10) >= 2 &&
      parseInt(gitVersion[1], 10) >= 22 &&
      parseInt(gitVersion[2], 10) >= 0
    ) {
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
