import changelogFilenameRegex from 'changelog-filename-regex';
import { linkify } from 'linkify-markdown';
import MarkdownIt from 'markdown-it';

import { api } from '../../../platform/github/gh-got-wrapper';
import { logger } from '../../../logger';
import { ChangeLogResult, ChangeLogNotes } from './common';

const { get: ghGot } = api;

const markdown = new MarkdownIt('zero');
markdown.enable(['heading', 'lheading']);

export async function getReleaseList(
  apiBaseURL: string,
  repository: string
): Promise<ChangeLogNotes[]> {
  logger.info('getReleaseList()');
  // istanbul ignore if
  if (!apiBaseURL) {
    logger.debug('No apiBaseURL!!!!!!!!!!!!!!!!!!!!!');
    return [];
  }
  try {
    let url = apiBaseURL.replace(/\/?$/, '/');
    if (apiBaseURL.search(/github/) != -1) {
      // github repo
      url += `repos/${repository}/releases?per_page=100`;
      logger.debug({ url }, 'Rendered URL to get releases');
      const res = await ghGot<
        {
          html_url: string;
          id: number;
          tag_name: string;
          name: string;
          body: string;
        }[]
      >(url);
      return res.body.map(release => ({
        url: release.html_url,
        id: release.id,
        tag: release.tag_name,
        name: release.name,
        body: release.body,
      }));
    } else {
      // not github, hopefully gitlab
      url += `projects/${repository.replace(
        /\//,
        '%2f'
      )}/releases?per_page=100`;
      logger.debug({ url }, 'Rendered URL to get releases');
      const res = await ghGot<
        {
          name: string;
          release: string;
        }[]
      >(url);
      return res.body.map(release => ({
        name: release.name,
        body: release.description,
      }));
    }
  } catch (err) /* istanbul ignore next */ {
    logger.info({ repository, err }, 'getReleaseList error');
    return [];
  }
}

export function massageBody(
  input: string | undefined | null,
  baseURL: string
): string {
  let body = input || '';
  // Convert line returns
  body = body.replace(/\r\n/g, '\n');
  // semantic-release cleanup
  body = body.replace(/^<a name="[^"]*"><\/a>\n/, '');
  body = body.replace(
    new RegExp(
      `^##? \\[[^\\]]*\\]\\(${baseURL}[^/]*\\/[^/]*\\/compare\\/.*?\\n`
    ),
    ''
  );
  // Clean-up unnecessary commits link
  body = `\n${body}\n`.replace(
    new RegExp(`\\n${baseURL}[^/]+\\/[^/]+\\/compare\\/[^\\n]+(\\n|$)`),
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

export async function getReleaseNotes(
  repository: string,
  version: string,
  depName: string,
  baseURL: string,
  apiBaseURL: string
): Promise<ChangeLogNotes | null> {
  logger.debug(`getReleaseNotes(${repository}, ${version}, ${depName})`);
  // apiPrefix += apiBaseUrl.search(/gitlab/) != -1 ? `projects/${repository}/releases/` : `repos/${repository}/contents/`;
  const releaseList = await getReleaseList(apiBaseURL, repository);
  logger.debug({ releaseList }, 'Release list from getReleaseList');
  let releaseNotes: ChangeLogNotes | null = null;
  releaseList.forEach(release => {
    // TODO: this might match only github, check
    if (
      release.tag === version ||
      release.tag === `v${version}` ||
      release.tag === `${depName}-${version}`
    ) {
      logger.debug('¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡¡ESTAMOS DENTRO!!!!!!!!!!!!!!!!');
      releaseNotes = release;
      releaseNotes.url = `${baseURL}${repository}/releases/${release.tag}`;
      releaseNotes.body = massageBody(releaseNotes.body, baseURL);
      if (!releaseNotes.body.length) {
        releaseNotes = null;
      } else {
        releaseNotes.body = linkify(releaseNotes.body, {
          repository: `https://github.com/${repository}`,
        });
      }
    }
  });
  logger.debug({ releaseNotes }, 'Release notes before return');
  return releaseNotes;
}

function sectionize(text: string, level: number): string[] {
  const sections: [number, number][] = [];
  const lines = text.split('\n');
  const tokens = markdown.parse(text, undefined);
  tokens.forEach(token => {
    if (token.type === 'heading_open') {
      const lev = +token.tag.substr(1);
      if (lev <= level) {
        sections.push([lev, token.map[0]]);
      }
    }
  });
  sections.push([-1, lines.length]);
  const result: string[] = [];
  for (let i = 1; i < sections.length; i += 1) {
    const [lev, start] = sections[i - 1];
    const [, end] = sections[i];
    if (lev === level) {
      result.push(lines.slice(start, end).join('\n'));
    }
  }
  return result;
}

/**
 * getReleaseNotesMd
 * When no release notes have been fetched from the releases api, this
 * is an attempt at getting them from a changelog markdown file in the
 * repository.
 * @param  {string} repository
 * @param {string} version
 * @param {string} baseURL
 * @param {string} apiBaseUrl
 * @returns {ChangeLogNotes | null}
 */
export async function getReleaseNotesMd(
  repository: string,
  version: string,
  baseURL: string,
  apiBaseUrl: string
): Promise<ChangeLogNotes | null> {
  // TODO: this is only github, but the sample project doesn't have Md notes,
  // so skipping right now
  logger.debug(`getReleaseNotesMd(${repository}, ${version})`);
  const skippedRepos = ['facebook/react-native'];
  // istanbul ignore if
  if (skippedRepos.includes(repository)) {
    return null;
  }
  let changelogFile: string;
  let changelogMd = '';
  try {
    let apiPrefix = apiBaseUrl.replace(/\/?$/, '/');
    // This is github specific
    apiPrefix +=
      apiBaseUrl.search(/gitlab/) != -1
        ? `projects/${repository}/releases/`
        : `repos/${repository}/contents/`;
    // logger.debug({ apiPrefix }, 'apiPrefix con project id');
    // in gitlab, will look something like projects/meno%2fdropzone/releases/
    const filesRes = await ghGot<{ name: string }[]>(apiPrefix);
    logger.debug({ filesRes }, 'filesRes con el apiPrefix que supongo un 404');
    const files = filesRes.body
      .map(f => f.name)
      .filter(f => changelogFilenameRegex.test(f));
    if (!files.length) {
      logger.trace('no changelog file found');
      return null;
    }
    [changelogFile] = files;
    /* istanbul ignore if */
    if (files.length > 1) {
      logger.debug(
        `Multiple candidates for changelog file, using ${changelogFile}`
      );
    }
    const fileRes = await ghGot<{ content: string }>(
      `${apiPrefix}/${changelogFile}`
    );
    changelogMd =
      Buffer.from(fileRes.body.content, 'base64').toString() + '\n#\n##';
  } catch (err) {
    logger.debug({ err }, 'Error somewhere');
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
          let body = section.replace(/.*?\n(-{3,}\n)?/, '').trim();
          for (const word of title) {
            if (word.includes(version)) {
              logger.trace({ body }, 'Found release notes for v' + version);
              let url = `${baseURL}${repository}/blob/master/${changelogFile}#`;
              url += title.join('-').replace(/[^A-Za-z0-9-]/g, '');
              body = massageBody(body, baseURL);
              if (body && body.length) {
                try {
                  body = linkify(body, {
                    repository: `https://github.com/${repository}`,
                  });
                } catch (err) /* istanbul ignore next */ {
                  logger.warn({ body, err }, 'linkify error');
                }
              }
              return {
                body,
                url,
              };
            }
          }
        } catch (err) /* istanbul ignore next */ {
          logger.warn({ err }, `Error parsing ${changelogFile}`);
        }
      }
    }
    logger.trace({ repository }, `No level ${level} changelogs headings found`);
  }
  logger.trace({ repository, version }, `No entry found in ${changelogFile}`);
  return null;
}

export async function addReleaseNotes(
  input: ChangeLogResult
): Promise<ChangeLogResult> {
  logger.debug({ input }, 'addReleaseNotes, input');
  if (
    !(input && input.project && input.project.github && input.versions) &&
    !(input && input.project && input.project.gitlab && input.versions)
  ) {
    logger.debug('Missing project or versions');
    return input;
  }
  const output: ChangeLogResult = { ...input, versions: [] };
  const repository =
    input.project.github != null
      ? input.project.github.replace(/\.git$/, '')
      : input.project.gitlab;
  logger.debug({ repository }, 'Repository (again)');
  const cacheNamespace = input.project.github
    ? 'changelog-github-notes'
    : 'changelog-gitlab-notes';
  function getCacheKey(version: string): string {
    return `${repository}:${version}`;
  }
  for (const v of input.versions) {
    logger.debug({ v }, '=============================Getting release notes');
    console.log(v);
    let releaseNotes: ChangeLogNotes;
    const cacheKey = getCacheKey(v.version);
    releaseNotes = await renovateCache.get(cacheNamespace, cacheKey);
    logger.debug({ releaseNotes }, 'releaseNotes');
    if (!releaseNotes) {
      releaseNotes = await getReleaseNotes(
        repository,
        v.version,
        input.project.depName,
        input.project.baseURL,
        input.project.apiBaseURL
      );
      if (!releaseNotes) {
        if (input.project.github != null) {
          releaseNotes = await getReleaseNotesMd(
            repository,
            v.version,
            input.project.baseURL,
            input.project.apiBaseURL
          );
        } else {
          logger.debug('Getting Md for gitlab');
          releaseNotes = await getReleaseNotesMd(
            repository.replace(/\//, '%2F'),
            v.version,
            input.project.baseURL,
            input.project.apiBaseURL
          );
        }
      }
      // Small hack to force display of release notes when there is a compare url
      if (!releaseNotes && v.compare.url) {
        releaseNotes = { url: v.compare.url };
      }
      const cacheMinutes = 55;
      await renovateCache.set(
        cacheNamespace,
        cacheKey,
        releaseNotes,
        cacheMinutes
      );
    }
    output.versions.push({
      ...v,
      releaseNotes,
    });
    output.hasReleaseNotes = output.hasReleaseNotes || !!releaseNotes;
  }
  return output;
}
