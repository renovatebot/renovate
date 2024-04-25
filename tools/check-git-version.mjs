import semver from 'semver';
import { simpleGit } from 'simple-git';

const GIT_MINIMUM_VERSION = '2.33.0';
const git = simpleGit();

await (async () => {
  try {
    const { major, minor, patch, installed } = await git.version();
    const gitVersion = `${major}.${minor}.${patch}`;
    if (!installed || semver.lt(gitVersion, GIT_MINIMUM_VERSION)) {
      if (process.env.CI) {
        console.log(
          `::error ::Minimum Git version ${GIT_MINIMUM_VERSION} is required, found version '${gitVersion}'.`,
        );
      } else {
        throw new Error(
          `Minimum Git version ${GIT_MINIMUM_VERSION} is required, found version '${gitVersion}'.`,
        );
      }
    }
    console.log('Found git version: ', gitVersion);
    process.exit(0);
  } catch (err) {
    console.log('ERROR:', err.message);
    process.exit(1);
  }
})();
