const os = require('os');
const changelog = require('changelog');
const cacache = require('cacache/en');

module.exports = {
  getReleaseNotes,
  getChangeLogJSON,
};

async function getReleaseNotes(repository, version) {
  logger.debug(`getReleaseNotes(${repository}, ${version})`);
  const releaseList = await platform.getReleaseList(repository);
  let releaseNotes;
  releaseList.forEach(release => {
    if (release.tag === version || release.tag === `v${version}`) {
      releaseNotes = release;
    }
  });
  logger.debug({ releaseNotes });
  return releaseNotes;
}

async function addReleaseNotes(repository, versions) {
  if (!(repository && versions)) {
    return versions;
  }
  const updatedVersions = [];
  for (const v of versions) {
    const releaseNotes = await getReleaseNotes(repository, v.version);
    logger.debug({ releaseNotes });
    updatedVersions.push({ ...v, releaseNotes });
  }
  return updatedVersions;
}

async function getChangeLogJSON(depName, fromVersion, newVersion) {
  logger.debug(`getChangeLogJSON(${depName}, ${fromVersion}, ${newVersion})`);
  if (!fromVersion || fromVersion === newVersion) {
    return null;
  }
  const cachePath =
    (process.env.RENOVATE_TMPDIR || os.tmpdir()) + '/renovate-changelog-cache';
  const cacheKey = `${depName}-${fromVersion}-${newVersion}`;

  // Return from cache if present
  try {
    const cacheVal = await cacache.get(cachePath, cacheKey);
    logger.debug(`Returning cached version of ${depName}`);
    const cachedResult = JSON.parse(cacheVal.data.toString());
    logger.debug({ cachedResult });
    cachedResult.versions = await addReleaseNotes(
      cachedResult.project ? cachedResult.project.github : null,
      cachedResult.versions
    );
    logger.debug({ cachedResult });
    return cachedResult;
  } catch (err) {
    logger.debug('Cache miss');
  }
  const semverString = `>${fromVersion} <=${newVersion}`;
  logger.debug(`semverString: ${semverString}`);
  try {
    const res = await changelog.generate(depName, semverString);
    if (!res) {
      logger.info({ depName, fromVersion, newVersion }, 'No changelog found');
      return null;
    }
    res.versions.reverse();
    await cacache.put(cachePath, cacheKey, JSON.stringify(res));
    res.versions = await addReleaseNotes(
      res.project ? res.project.github : null,
      res.versions
    );
    logger.debug({ res });
    return res;
  } catch (err) {
    logger.debug({ err }, `getChangeLogJSON error`);
    return null;
  }
}
