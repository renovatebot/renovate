const ghGot = require('../../platform/github/gh-got-wrapper');

module.exports = {
  getReleaseList,
  massageBody,
  getReleaseNotes,
  addReleaseNotes,
};

async function getReleaseList(repository) {
  logger.debug('getReleaseList()');
  try {
    const res = await ghGot(`repos/${repository}/releases?per_page=100`);
    return res.body.map(release => ({
      url: release.html_url,
      id: release.id,
      tag: release.tag_name,
      name: release.name,
      body: release.body,
    }));
  } catch (err) /* istanbul ignore next */ {
    logger.error({ err }, 'getReleaseList error');
    return [];
  }
}

function massageBody(input) {
  let body = input || '';
  // Convert line returns
  body = body.replace(/\r\n/g, '\n');
  // semantic-release cleanup
  body = body.replace(/^<a name="[^"]*"><\/a>\n/, '');
  body = body.replace(
    /^##? \[[^\]]*\]\(https:\/\/github.com\/[^/]*\/[^/]*\/compare\/.*?\n/,
    ''
  );
  // Clean-up unnecessary commits link
  body = `\n${body}\n`.replace(
    /\nhttps:\/\/github.com\/[^/]+\/[^/]+\/compare\/[^\n]+(\n|$)/,
    '\n'
  );
  // Reduce headings size
  body = body
    .replace(/\n#### /g, '\n##### ')
    .replace(/\n(#{1,3}) /g, '\n##$1 ');
  // Trim whitespace
  return body.trim();
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

async function addReleaseNotes(input) {
  if (!(input.project && input.project.github && input.versions)) {
    logger.debug('Missing project or versions');
    return input;
  }
  const output = { ...input, versions: [] };
  for (const v of input.versions) {
    const releaseNotes = await getReleaseNotes(input.project.github, v.version);
    logger.debug({ releaseNotes });
    output.versions.push({ ...v, releaseNotes });
    output.hasReleaseNotes = !!releaseNotes;
  }
  logger.debug({ output });
  return output;
}
