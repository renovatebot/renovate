import changelogFilenameRegex from 'changelog-filename-regex';
import { linkify } from 'linkify-markdown';
import MarkdownIt from 'markdown-it';
import * as URL from 'url';

import { api } from '../../../platform/github/gh-got-wrapper';
import { api as api_gitlab } from '../../../platform/gitlab/gl-got-wrapper';
import { logger } from '../../../logger';
import { ChangeLogResult, ChangeLogNotes } from './common';

const { get: ghGot } = api;
const { get: glGot } = api_gitlab;

const markdown = new MarkdownIt('zero');
markdown.enable(['heading', 'lheading']);

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
    const res = await ghGot<
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
    logger.info({ repository, err }, 'getReleaseList error');
    return [];
  }
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
  const releaseList = await getReleaseList(apiBaseUrl, repository);
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
  let changelogFile: string;
  let changelogMd = '';
  try {
    let apiPrefix = apiBaseUrl.replace(/\/?$/, '/');
    apiPrefix += apiBaseUrl.includes('gitlab')
      ? `projects/${repository}/repository/tree`
      : `repos/${repository}/contents/`;
    // in gitlab, will look something like projects/meno%2fdropzone/releases/
    const filesRes = await ghGot<{ name: string }[]>(apiPrefix);
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
    const fileRes = await ghGot<{ content: string }>(
      `${apiPrefix}/${changelogFile}`
    );
    changelogMd =
      Buffer.from(fileRes.body.content, 'base64').toString() + '\n#\n##';
  } catch (err) {
    logger.debug({ err }, 'Error getting changelog md');
    return null;
  }

  changelogMd = changelogMd.replace(/\n\s*<a name="[^"]*">.*?<\/a>\n/g, '\n');
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
    releaseNotes = await renovateCache.get(cacheNamespace, cacheKey);
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
