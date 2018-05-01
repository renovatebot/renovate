const ghGot = require('../../platform/github/gh-got-wrapper');
const changelogFilenameRegex = require('changelog-filename-regex');
const MarkdownIt = require('markdown-it');

const markdown = new MarkdownIt('zero');
markdown.enable(['heading', 'lheading']);

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
    const res = await ghGot(
      `https://api.github.com/repos/${repository}/releases?per_page=100`
    );
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
  logger.trace({ releaseNotes });
  return releaseNotes;
}

function sectionize(text, level) {
  const sections = [];
  const lines = text.split('\n');
  const tokens = markdown.parse(text);
  tokens.forEach(token => {
    if (token.type === 'heading_open') {
      const lev = +token.tag.substr(1);
      if (lev <= level) {
        sections.push([lev, token.map[0]]);
      }
    }
  });
  sections.push([-1, lines.length]);
  const result = [];
  for (let i = 1; i < sections.length; i += 1) {
    const [lev, start] = sections[i - 1];
    const [, end] = sections[i];
    if (lev === level) {
      result.push(lines.slice(start, end).join('\n'));
    }
  }
  return result;
}

async function getReleaseNotesMd(repository, version) {
  logger.debug(`getReleaseNotes(${repository}, ${version})`);
  let changelogMd = '';
  try {
    const apiPrefix = `https://api.github.com/repos/${repository}/contents/`;
    const filesRes = await ghGot(apiPrefix);
    const files = filesRes.body
      .map(f => f.name)
      .filter(f => changelogFilenameRegex.test(f));
    if (!files.length) {
      logger.trace('no changelog file found');
      return null;
    }
    const file = files[0];
    /* istanbul ignore if */
    if (files.length > 1) {
      logger.info(`Multiple candidates for changelog file, using ${file}`);
    }
    const fileRes = await ghGot(`${apiPrefix}/${file}`);
    changelogMd =
      Buffer.from(fileRes.body.content, 'base64').toString() + '\n#\n##';
  } catch (err) {
    // Probably a 404?
    return null;
  }

  changelogMd = changelogMd.replace(/\n\s*<a name="[^"]*">.*?<\/a>\n/g, '\n');
  for (const level of [1, 2, 3, 4, 5, 6, 7]) {
    const changelogParsed = sectionize(changelogMd, level);
    if (changelogParsed.length >= 2) {
      for (const section of changelogParsed) {
        try {
          const [heading] = section.split('\n');
          const title = heading
            .replace(/^\s*#*\s*/, '')
            .split(' ')
            .filter(Boolean);
          const body = section.replace(/.*?\n(-{3,}\n)?/, '').trim();
          for (const word of title) {
            if (word.includes(version)) {
              logger.trace({ body }, 'Found release notes for v' + version);
              let url = `https://github.com/${repository}/blob/master/CHANGELOG.md#`;
              url += title.join('-').replace(/[^A-Za-z0-9-]/g, '');
              return {
                body: massageBody(body),
                url,
              };
            }
          }
        } catch (err) /* istanbul ignore next */ {
          logger.warn({ err }, 'Error parsing CHANGELOG.md');
        }
      }
    }
    logger.debug({ repository }, `No level ${level} changelogs headings found`);
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
      logger.trace('No markdown release notes found for v' + v.version);
      releaseNotes = await getReleaseNotes(input.project.github, v.version);
    }
    // Small hack to force display of release notes when there is a compare url
    if (!releaseNotes && v.compare.url) {
      releaseNotes = { url: v.compare.url };
    }
    output.versions.push({
      ...v,
      releaseNotes,
    });
    output.hasReleaseNotes = output.hasReleaseNotes || !!releaseNotes;
  }
  return output;
}
