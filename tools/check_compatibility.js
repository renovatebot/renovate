const shell = require('shelljs');

function checkgitversion() {
  try {
    const gitversion = shell
      .exec('git --version', { silent: true })
      .stdout.toString()
      .slice(12)
      .split('.');
    if (
      parseInt(gitversion[0], 10) >= 2 &&
      parseInt(gitversion[1], 10) >= 22 &&
      parseInt(gitversion[2], 10) >= 0
    ) {
      process.exit(0);
    } else {
      // shell.echo('WARNING: GIT VERSION NOT COMAPTIBLE');
      throw new Error('GIT VERSION NOT COMAPTIBLE');
    }
  } catch (err) {
    shell.echo('ERROR:', err.message);
    process.exit(1);
  }
}
checkgitversion();
