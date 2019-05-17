const { exec } = require('child-process-promise');

module.exports = {
  getPkgReleases,
};

async function getPkgReleases({ lookupName }) {
  logger.debug('cocoapods.getPkgReleases()');
  if (!lookupName) {
    return null;
  }

  let cmd = `pod search --no-pager --no-ansi --simple --regex ^${lookupName}$ | grep Versions | sed 's/.*\\: //' | sed 's/\\[.*//'`;
  try {
    logger.debug({ cmd }, 'Start pod search command');
    let stdout;
    let stderr;
    ({ stdout, stderr } = await exec(cmd, {
      shell: true,
    }));
    logger.trace({ cmd }, `Got pod search response ${stdout}, ${stderr}`);
    let releases = stdout.split(',').map(el => {
      return { version: el.trim() };
    });
    return { releases };
  } catch (err) {
    logger.warn({ err });
    logger.info('Aborting Renovate due to pod search errors');
    throw new Error('registry-failure');
  }
}
