const ghGot = require('../../platform/github/gh-got-wrapper');

module.exports = {
  getReleaseList,
  massageBody,
  getReleaseNotesMd,
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
    logger.info({ repository, err }, 'getReleaseList error');
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
    .replace(/\n\s*####? /g, '\n##### ')
    .replace(/\n\s*## /g, '\n#### ')
    .replace(/\n\s*# /g, '\n### ');
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
      releaseNotes.url = `https://github.com/${repository}/releases/${
        release.tag
      }`;
      releaseNotes.body = massageBody(releaseNotes.body);
      if (!releaseNotes.body.length) {
        releaseNotes = undefined;
      }
    }
  });
  logger.debug({ releaseNotes });
  return releaseNotes;
}

async function getReleaseNotesMd(repository, version) {
  logger.debug(`getReleaseNotes(${repository}, ${version})`);
  let changelogMd;
  try {
    const res = await ghGot(`repos/${repository}/contents/CHANGELOG.md`);
    changelogMd =
      Buffer.from(res.body.content, 'base64').toString() + '\n#\n##';
  } catch (err) {
    // Probably a 404
  }
  if (!changelogMd) {
    logger.debug('CHANGELOG.md not found');
    return null;
  }
  changelogMd = changelogMd.replace(/\n\s*<a name="[^"]*">.*?<\/a>\n/g, '\n');
  let changelogParsed = changelogMd.match(/^#([^#]+?)\n([^]+?)(?=^#[^#])/gm);
  if (!changelogParsed || changelogParsed.length === 1) {
    logger.trace('Could not parse top level headings. Trying second level');
    changelogParsed = changelogMd.match(/^##([^#]+?)\n([^]+?)(?=^##[^#])/gm);
    if (!changelogParsed || changelogParsed.length === 1) {
      logger.info({ repository }, 'No second level changelogs headings found');
      return null;
    }
  }
  for (const section of changelogParsed) {
    try {
      const [heading] = section.split('\n');
      const [, ...title] = heading.split(' ');
      const body = section.replace(/.*?\n/, '').trim();
      if (title) {
        for (let i = 0; i < title.length; i += 1) {
          if (title[i].endsWith(version) || title[i].includes(`[${version}]`)) {
            logger.trace({ body }, 'Found release notes for v' + version);
            let url = `https://github.com/${repository}/blob/master/CHANGELOG.md#`;
            url += title.join('-').replace(/[^A-Za-z0-9-]/g, '');
            return {
              body: massageBody(body),
              url,
            };
          }
        }
      }
    } catch (err) /* istanbul ignore next */ {
      logger.warn({ err }, 'Error parsing CHANGELOG.md');
    }
  }
  logger.debug({ repository, version }, 'No entry found in CHANGELOG.md');
  return null;
}

async function addReleaseNotes(input) {
  if (!(input && input.project && input.project.github && input.versions)) {
    logger.debug('Missing project or versions');
    return input;
  }
  const output = { ...input, versions: [] };
  for (const v of input.versions) {
    let releaseNotes = await getReleaseNotesMd(input.project.github, v.version);
    if (!releaseNotes) {
      logger.debug('No markdown release notes found for v' + v.version);
      releaseNotes = await getReleaseNotes(input.project.github, v.version);
    }
    output.versions.push({
      ...v,
      releaseNotes,
    });
    output.hasReleaseNotes = output.hasReleaseNotes || !!releaseNotes;
  }
  return output;
}
