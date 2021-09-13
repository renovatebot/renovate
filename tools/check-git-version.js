import semver from 'semver';
import shell from 'shelljs';

const GIT_MINIMUM_VERSION = '2.33.0';

try {
  const regex = /\d+\.\d+\.\d+/;
  const { stdout } = shell.exec('git --version', { silent: true });
  const [gitVersion] = regex.exec(stdout);
  if (semver.lt(gitVersion, GIT_MINIMUM_VERSION)) {
    throw new Error(
      `Minimum git version ${GIT_MINIMUM_VERSION} is required`
    );
  }
  process.exit(0);
} catch (err) {
  shell.echo('ERROR:', err.message);
  process.exit(1);
}
