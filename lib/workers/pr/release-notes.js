const ghGot = require('gh-got');

module.exports = {
  getReleaseList,
  massageBody,
  getReleaseNotes,
  addReleaseNotes,
};

async function getReleaseList(repository) {
  logger.debug('getReleaseList()');
  try {
    const res = await ghGot(`repos/${repository}/releases`);
    return res.body.map(release => ({
      url: release.html_url,
      id: release.id,
      tag: release.tag_name,
      name: release.name,
      body: release.body,
    }));
  } catch (err) {
    logger.err({ err }, 'getReleaseList error');
    return [];
  }
}

function massageBody(body) {
  let massagedBody = body;
  logger.debug({ massagedBody }, 'pre-massage');
  // semantic-release cleanup
  massagedBody = massagedBody.replace(/^<a name="[^"]*"><\/a>\n/, '');
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
  const releaseList = await getReleaseList(repository);
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
