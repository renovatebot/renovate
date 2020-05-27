import * as URL from 'url';
import changelogFilenameRegex from 'changelog-filename-regex';
import { linkify } from 'linkify-markdown';
import MarkdownIt from 'markdown-it';

import { logger } from '../../../logger';
import { api as api_gitlab } from '../../../platform/gitlab/gl-got-wrapper';
import * as globalCache from '../../../util/cache/global';
import * as runCache from '../../../util/cache/run';
import { GithubHttp } from '../../../util/http/github';
import { ChangeLogNotes, ChangeLogResult } from './common';

const { get: glGot } = api_gitlab;

const markdown = new MarkdownIt('zero');
markdown.enable(['heading', 'lheading']);

const http = new GithubHttp();

export async function getReleaseList(
  apiBaseUrl: string,
  repository: string
): Promise<ChangeLogNotes[]> {
  logger.trace('getReleaseList()');
  // istanbul ignore if
  if (!apiBaseUrl) {
    logger.debug('No apiBaseUrl');
    return [];
  }
  try {
    let url = apiBaseUrl.replace(/\/?$/, '/');
    if (apiBaseUrl.includes('gitlab')) {
      url += `projects/${repository.replace(
        /\//g,
        '%2f'
      )}/releases?per_page=100`;
      const res = await glGot<
        {
          name: string;
          release: string;
          description: string;
          tag_name: string;
        }[]
      >(url);
      return res.body.map((release) => ({
        url: `${apiBaseUrl}projects/${repository.replace(
          /\//g,
          '%2f'
        )}/releases/${release.tag_name}`,
        name: release.name,
        body: release.description,
        tag: release.tag_name,
      }));
    }
    url += `repos/${repository}/releases?per_page=100`;
    const res = await http.getJson<
      {
        html_url: string;
        id: number;
        tag_name: string;
        name: string;
        body: string;
      }[]
    >(url);
    return res.body.map((release) => ({
      url: release.html_url,
      id: release.id,
      tag: release.tag_name,
      name: release.name,
      body: release.body,
    }));
  } catch (err) /* istanbul ignore next */ {
    if (err.statusCode === 404) {
      logger.debug({ repository }, 'getReleaseList 404');
    } else {
      logger.info({ repository, err }, 'getReleaseList error');
    }
    return [];
  }
}

export function getCachedReleaseList(
  apiBaseUrl: string,
  repository: string
): Promise<ChangeLogNotes[]> {
  const cacheKey = `getReleaseList-${apiBaseUrl}-${repository}`;
  const cachedResult = runCache.get(cacheKey);
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }
  const promisedRes = getReleaseList(apiBaseUrl, repository);
  runCache.set(cacheKey, promisedRes);
  return promisedRes;
}

export function massageBody(
  input: string | undefined | null,
  baseUrl: string
): string {
  let body = input || '';
  // Convert line returns
  body = body.replace(/\r\n/g, '\n');
  // semantic-release cleanup
  body = body.replace(/^<a name="[^"]*"><\/a>\n/, '');
  body = body.replace(
    new RegExp(
      `^##? \\[[^\\]]*\\]\\(${baseUrl}[^/]*\\/[^/]*\\/compare\\/.*?\\n`
    ),
    ''
  );
  // Clean-up unnecessary commits link
  body = `\n${body}\n`.replace(
    new RegExp(`\\n${baseUrl}[^/]+\\/[^/]+\\/compare\\/[^\\n]+(\\n|$)`),
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
  baseUrl: string,
  apiBaseUrl: string
): Promise<ChangeLogNotes | null> {
  logger.trace(`getReleaseNotes(${repository}, ${version}, ${depName})`);
  const releaseList = await getCachedReleaseList(apiBaseUrl, repository);
  logger.trace({ releaseList }, 'Release list from getReleaseList');
  let releaseNotes: ChangeLogNotes | null = null;
  releaseList.forEach((release) => {
    if (
      release.tag === version ||
      release.tag === `v${version}` ||
      release.tag === `${depName}-${version}`
    ) {
      releaseNotes = release;
      releaseNotes.url = baseUrl.includes('gitlab')
        ? `${baseUrl}${repository}/tags/${release.tag}`
        : `${baseUrl}${repository}/releases/${release.tag}`;
      releaseNotes.body = massageBody(releaseNotes.body, baseUrl);
      if (!releaseNotes.body.length) {
        releaseNotes = null;
      } else {
        releaseNotes.body = linkify(releaseNotes.body, {
          repository: `${baseUrl}${repository}`,
        });
      }
    }
  });
  logger.trace({ releaseNotes });
  return releaseNotes;
}

function sectionize(text: string, level: number): string[] {
  const sections: [number, number][] = [];
  const lines = text.split('\n');
  const tokens = markdown.parse(text, undefined);
  tokens.forEach((token) => {
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

function isUrl(url: string): boolean {
  try {
    return !!URL.parse(url).hostname;
  } catch (err) {
    // istanbul ignore next
    logger.debug({ err }, `Error parsing ${url} in URL.parse`);
  }
  // istanbul ignore next
  return false;
}

export async function getReleaseNotesMdFileInner(
  repository: string,
  apiBaseUrl: string
): Promise<{ changelogFile: string; changelogMd: string }> | null {
  let changelogFile: string;
  let apiTree: string;
  let apiFiles: string;
  let filesRes: { body: { name: string }[] };
  try {
    const apiPrefix = apiBaseUrl.replace(/\/?$/, '/');
    if (apiBaseUrl.includes('gitlab')) {
      apiTree = apiPrefix + `projects/${repository}/repository/tree/`;
      apiFiles = apiPrefix + `projects/${repository}/repository/files/`;
      filesRes = await glGot<{ name: string }[]>(apiTree);
    } else {
      apiTree = apiPrefix + `repos/${repository}/contents/`;
      apiFiles = apiTree;
      filesRes = await http.getJson<{ name: string }[]>(apiTree);
    }
    const files = filesRes.body
      .map((f) => f.name)
      .filter((f) => changelogFilenameRegex.test(f));
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
    let fileRes: { body: { content: string } };
    if (apiBaseUrl.includes('gitlab')) {
      fileRes = await glGot<{ content: string }>(
        `${apiFiles}${changelogFile}?ref=master`
      );
    } else {
      fileRes = await http.getJson<{ content: string }>(
        `${apiFiles}${changelogFile}`
      );
    }

    const changelogMd =
      Buffer.from(fileRes.body.content, 'base64').toString() + '\n#\n##';
    return { changelogFile, changelogMd };
  } catch (err) /* istanbul ignore next */ {
    if (err.statusCode === 404) {
      logger.debug('Error 404 getting changelog md');
    } else {
      logger.debug({ err }, 'Error getting changelog md');
    }
    return null;
  }
}

export async function getReleaseNotesMdFile(
  repository: string,
  apiBaseUrl: string
): Promise<{ changelogFile: string; changelogMd: string }> | null {
  const cacheKey = `getReleaseNotesMdFile-${repository}-${apiBaseUrl}`;
  const cachedResult = runCache.get(cacheKey);
  // istanbul ignore if
  if (cachedResult !== undefined) {
    return cachedResult;
  }
  const promisedRes = getReleaseNotesMdFileInner(repository, apiBaseUrl);
  runCache.set(cacheKey, promisedRes);
  return promisedRes;
}

export async function getReleaseNotesMd(
  repository: string,
  version: string,
  baseUrl: string,
  apiBaseUrl: string
): Promise<ChangeLogNotes | null> {
  logger.trace(`getReleaseNotesMd(${repository}, ${version})`);
  const skippedRepos = ['facebook/react-native'];
  // istanbul ignore if
  if (skippedRepos.includes(repository)) {
    return null;
  }
  const changelog = await getReleaseNotesMdFile(repository, apiBaseUrl);
  if (!changelog) {
    return null;
  }
  const { changelogFile } = changelog;
  const changelogMd = changelog.changelogMd.replace(
    /\n\s*<a name="[^"]*">.*?<\/a>\n/g,
    '\n'
  );
  for (const level of [1, 2, 3, 4, 5, 6, 7]) {
    const changelogParsed = sectionize(changelogMd, level);
    if (changelogParsed.length >= 2) {
      for (const section of changelogParsed) {
        try {
          // replace brackets and parenthesis with space
          const deParenthesizedSection = section.replace(/[[\]()]/g, ' ');
          const [heading] = deParenthesizedSection.split('\n');
          const title = heading
            .replace(/^\s*#*\s*/, '')
            .split(' ')
            .filter(Boolean);
          let body = section.replace(/.*?\n(-{3,}\n)?/, '').trim();
          for (const word of title) {
            if (word.includes(version) && !isUrl(word)) {
              logger.trace({ body }, 'Found release notes for v' + version);
              let url = `${baseUrl}${repository}/blob/master/${changelogFile}#`;
              url += title.join('-').replace(/[^A-Za-z0-9-]/g, '');
              body = massageBody(body, baseUrl);
              if (body && body.length) {
                try {
                  body = linkify(body, {
                    repository: `${baseUrl}${repository}`,
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
  if (
    !input?.versions ||
    (!input?.project?.github && !input?.project?.gitlab)
  ) {
    logger.debug('Missing project or versions');
    return input;
  }
  const output: ChangeLogResult = { ...input, versions: [] };
  const repository =
    input.project.github != null
      ? input.project.github.replace(/\.git$/, '')
      : input.project.gitlab;
  const cacheNamespace = input.project.github
    ? 'changelog-github-notes'
    : 'changelog-gitlab-notes';
  function getCacheKey(version: string): string {
    return `${repository}:${version}`;
  }
  for (const v of input.versions) {
    let releaseNotes: ChangeLogNotes;
    const cacheKey = getCacheKey(v.version);
    releaseNotes = await globalCache.get(cacheNamespace, cacheKey);
    if (!releaseNotes) {
      if (input.project.github != null) {
        releaseNotes = await getReleaseNotesMd(
          repository,
          v.version,
          input.project.baseUrl,
          input.project.apiBaseUrl
        );
      } else {
        releaseNotes = await getReleaseNotesMd(
          repository.replace(/\//g, '%2F'),
          v.version,
          input.project.baseUrl,
          input.project.apiBaseUrl
        );
      }
      if (!releaseNotes) {
        releaseNotes = await getReleaseNotes(
          repository,
          v.version,
          input.project.depName,
          input.project.baseUrl,
          input.project.apiBaseUrl
        );
      }
      // Small hack to force display of release notes when there is a compare url
      if (!releaseNotes && v.compare.url) {
        releaseNotes = { url: v.compare.url };
      }
      const cacheMinutes = 55;
      await globalCache.set(
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
