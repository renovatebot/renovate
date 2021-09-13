import semver from 'semver';
import shell from 'shelljs';
import simpleGit from 'simple-git';

const GIT_MINIMUM_VERSION = '2.33.0';
const git = simpleGit();
async function checkGitVersion() {
  try {
    const regex = /\d+\.\d+\.\d+/;
    const stdout = await git.raw('--version');
    const [gitVersion] = regex.exec(stdout);
    if (semver.lt(gitVersion, GIT_MINIMUM_VERSION)) {
      throw new Error(`Minimum git version ${GIT_MINIMUM_VERSION} is required`);
    }
    process.exit(0);
  } catch (err) {
    shell.echo('ERROR:', err.message);
    process.exit(1);
  }
}
checkGitVersion();
