const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child-process-promise');

module.exports = {
  getPkgReleases,
};

let lastSync = new Date('2000-01-01');

function olderThan5Minutes(newDate) {
  const minutesElapsed = Math.floor((newDate - lastSync) / (60 * 1000));
  return minutesElapsed >= 5;
}

async function getPkgReleases({ cacheDir, lookupName, registryUrls }) {
  debugger;
  const rubyCacheDir = path.join(cacheDir, './rubygems');
  const versionsCache = path.join(rubyCacheDir, './versions');
  const now = new Date();
  if (olderThan5Minutes(now)) {
    logger.info('Need to sync rubygems versions');
    await fs.ensureDir(rubyCacheDir);
    try {
      const { stderr, stdout } = await exec(
        `wget --continue https://rubygems.org/versions`,
        {
          cwd: rubyCacheDir,
        }
      );
      logger.info({ stderr, stdout }, 'wget result');
    } catch (err) {
      logger.warn({ err }, 'Error retrieving rubygems versions');
      throw new Error('registry-failure');
    }
  }
  const rawVersions = await fs.readFile(versionsCache, 'utf8');
  const parsedVersions = Object.create(null); // Because we might need a "constructor" key
  for (const line of rawVersions.split('\n')) {
    let split, pkg, versions;
    try {
      const l = line.trim();
      if (!l.length || l.startsWith('created_at:') || l === '---') {
        continue;
      }
      split = l.split(' ');
      [pkg, versions] = split;
      parsedVersions[pkg] = parsedVersions[pkg] || [];
      parsedVersions[pkg] = parsedVersions[pkg].concat(versions.split(','));
    } catch (err) {
      logger.warn({ err, line, split, pkg, versions });
    }
  }
  debugger;
}
