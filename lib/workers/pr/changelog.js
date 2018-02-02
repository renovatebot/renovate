const os = require('os');
const changelog = require('changelog');
const cacache = require('cacache/en');

module.exports = {
  getReleaseNotes,
  getChangeLogJSON,
};

function massageBody(body) {
  let massagedBody = body;
  logger.debug({ massagedBody }, 'pre-massage');
  // semantic-release cleanup
  massagedBody = massagedBody.replace(/^<a name=\"[^"]*"><\/a>\n/, '');
  logger.debug({ massagedBody }, 'after removing a name');
  massagedBody = massagedBody.replace(
    /^##? \[[^\]]*\]\(https:\/\/github.com\/[^/]*\/[^/]*\/compare\/.*?\n/,
    ''
  );
  logger.debug({ massagedBody }, 'after removing compare');
  if (massagedBody !== body) {
    logger.debug('Cleaned up semantic-release release note');
  }
  // np clean-up
  massagedBody = massagedBody.replace(
    /https:\/\/github.com\/[^/]+\/[^/]+\/compare\/[^\n]+$/,
    ''
  );
  massagedBody = massagedBody.replace(/\r\n/g, '\n');
  massagedBody = massagedBody.replace(/\n+$/, '');
  return massagedBody;
}

async function getReleaseNotes(repository, version) {
  logger.debug(`getReleaseNotes(${repository}, ${version})`);
  const releaseList = await platform.getReleaseList(repository);
  let releaseNotes;
  releaseList.forEach(release => {
    if (release.tag === version || release.tag === `v${version}`) {
      releaseNotes = release;
      releaseNotes.body = massageBody(releaseNotes.body);
      if (!releaseNotes.body.length) {
        releaseNotes = undefined;
      }
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
    // Sort from oldest to newest
    logger.debug({ res });
    if (Array.isArray(res.versions)) {
      res.versions.reverse();
      res.versions.forEach(version => {
        if (Array.isArray(version.changes)) {
          version.changes.reverse();
        }
      });
    }
    await cacache.put(cachePath, cacheKey, JSON.stringify(res));
    res.versions = await addReleaseNotes(
      res.project ? res.project.github : null,
      res.versions
    );
    return res;
  } catch (err) {
    logger.debug({ err }, `getChangeLogJSON error`);
    return null;
  }
}
