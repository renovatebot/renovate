import * as URL from 'url';
import is from '@sindresorhus/is';
import { linkify } from 'linkify-markdown';
import { DateTime } from 'luxon';
import MarkdownIt from 'markdown-it';

import {
  PLATFORM_TYPE_GITHUB,
  PLATFORM_TYPE_GITLAB,
} from '../../../constants/platforms';
import { logger } from '../../../logger';
import * as memCache from '../../../util/cache/memory';
import * as packageCache from '../../../util/cache/package';
import { ChangeLogFile, ChangeLogNotes, ChangeLogResult } from './common';
import * as github from './github';
import * as gitlab from './gitlab';

const markdown = new MarkdownIt('zero');
markdown.enable(['heading', 'lheading']);

export async function getReleaseList(
  apiBaseUrl: string,
  repository: string,
  changelogPlatform: string = PLATFORM_TYPE_GITHUB
): Promise<ChangeLogNotes[]> {
  logger.trace('getReleaseList()');
  // istanbul ignore if
  if (!apiBaseUrl) {
    logger.debug('No apiBaseUrl');
    return [];
  }
  try {
    if (changelogPlatform === PLATFORM_TYPE_GITLAB) {
      return await gitlab.getReleaseList(apiBaseUrl, repository);
    }
    return await github.getReleaseList(apiBaseUrl, repository);
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
  repository: string,
  changelogPlatform: string
): Promise<ChangeLogNotes[]> {
  const cacheKey = `getReleaseList-${apiBaseUrl}-${repository}`;
  const cachedResult = memCache.get<Promise<ChangeLogNotes[]>>(cacheKey);
  // istanbul ignore if
  if (cachedResult !== undefined) {
    return cachedResult;
  }
  const promisedRes = getReleaseList(apiBaseUrl, repository, changelogPlatform);
  memCache.set(cacheKey, promisedRes);
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
  apiBaseUrl: string,
  changelogPlatform: string = PLATFORM_TYPE_GITHUB
): Promise<ChangeLogNotes | null> {
  logger.trace(`getReleaseNotes(${repository}, ${version}, ${depName})`);
  const releaseList = await getCachedReleaseList(
    apiBaseUrl,
    repository,
    changelogPlatform
  );
  logger.trace({ releaseList }, 'Release list from getReleaseList');
  let releaseNotes: ChangeLogNotes | null = null;
  releaseList.forEach((release) => {
    if (
      release.tag === version ||
      release.tag === `v${version}` ||
      release.tag === `${depName}-${version}` ||
      release.tag === `${depName}_v${version}` ||
      release.tag === `${depName}@${version}`
    ) {
      releaseNotes = release;
      releaseNotes.url =
        changelogPlatform === PLATFORM_TYPE_GITLAB
          ? `${baseUrl}${repository}/tags/${release.tag}`
          : `${baseUrl}${repository}/releases/${release.tag}`;
      releaseNotes.body = massageBody(releaseNotes.body, baseUrl);
      if (!releaseNotes.body.length) {
        releaseNotes = null;
      } else {
        try {
          // do not linkify if we have a gitlab repository, as currently
          // linkify-markdown does not correctly extract gitlab repository urls
          if (changelogPlatform !== PLATFORM_TYPE_GITLAB) {
            releaseNotes.body = linkify(releaseNotes.body, {
              repository: `${baseUrl}${repository}`,
            });
          }
        } catch (err) /* istanbul ignore next */ {
          logger.warn({ err, baseUrl, repository }, 'Error linkifying');
        }
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
  apiBaseUrl: string,
  changelogPlatform: string
): Promise<ChangeLogFile> | null {
  try {
    if (changelogPlatform === PLATFORM_TYPE_GITLAB) {
      return await gitlab.getReleaseNotesMd(repository, apiBaseUrl);
    }
    return await github.getReleaseNotesMd(repository, apiBaseUrl);
  } catch (err) /* istanbul ignore next */ {
    if (err.statusCode === 404) {
      logger.debug('Error 404 getting changelog md');
    } else {
      logger.debug({ err, repository }, 'Error getting changelog md');
    }
    return null;
  }
}

export function getReleaseNotesMdFile(
  repository: string,
  apiBaseUrl: string,
  changelogPlatform: string
): Promise<ChangeLogFile | null> {
  const cacheKey = `getReleaseNotesMdFile-${repository}-${apiBaseUrl}`;
  const cachedResult = memCache.get<Promise<ChangeLogFile | null>>(cacheKey);
  // istanbul ignore if
  if (cachedResult !== undefined) {
    return cachedResult;
  }
  const promisedRes = getReleaseNotesMdFileInner(
    repository,
    apiBaseUrl,
    changelogPlatform
  );
  memCache.set(cacheKey, promisedRes);
  return promisedRes;
}

export async function getReleaseNotesMd(
  repository: string,
  version: string,
  baseUrl: string,
  apiBaseUrl: string,
  changelogPlatform: string = PLATFORM_TYPE_GITHUB
): Promise<ChangeLogNotes | null> {
  logger.trace(`getReleaseNotesMd(${repository}, ${version})`);
  const skippedRepos = ['facebook/react-native'];
  // istanbul ignore if
  if (skippedRepos.includes(repository)) {
    return null;
  }
  const changelog = await getReleaseNotesMdFile(
    repository,
    apiBaseUrl,
    changelogPlatform
  );
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
              // TODO: fix url
              let url = `${baseUrl}${repository}/blob/master/${changelogFile}#`;
              url += title.join('-').replace(/[^A-Za-z0-9-]/g, '');
              body = massageBody(body, baseUrl);
              if (body?.length) {
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

/**
 * Determine how long to cache release notes based on when the version was released.
 *
 * It's not uncommon for release notes to be updated shortly after the release itself,
 * so only cache for about an hour when the release is less than a week old. Otherwise,
 * cache for days.
 */
export function releaseNotesCacheMinutes(releaseDate?: string | Date): number {
  const dt = is.date(releaseDate)
    ? DateTime.fromJSDate(releaseDate)
    : DateTime.fromISO(releaseDate);

  const now = DateTime.local();

  if (!dt.isValid || now.diff(dt, 'days').days < 7) {
    return 55;
  }

  if (now.diff(dt, 'months').months < 6) {
    return 1435; // 5 minutes shy of one day
  }

  return 14495; // 5 minutes shy of 10 days
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
    releaseNotes = await packageCache.get(cacheNamespace, cacheKey);
    // istanbul ignore else: no cache tests
    if (!releaseNotes) {
      const changelogPlatform =
        input.project.gitlab ||
        input.project.apiBaseUrl?.includes('gitlab') ||
        input.project.baseUrl?.includes('gitlab')
          ? PLATFORM_TYPE_GITLAB
          : PLATFORM_TYPE_GITHUB;

      releaseNotes = await getReleaseNotesMd(
        repository,
        v.version,
        input.project.baseUrl,
        input.project.apiBaseUrl,
        changelogPlatform
      );
      // istanbul ignore else: should be tested
      if (!releaseNotes) {
        releaseNotes = await getReleaseNotes(
          repository,
          v.version,
          input.project.depName,
          input.project.baseUrl,
          input.project.apiBaseUrl,
          changelogPlatform
        );
      }
      // Small hack to force display of release notes when there is a compare url
      if (!releaseNotes && v.compare.url) {
        releaseNotes = { url: v.compare.url };
      }
      const cacheMinutes = releaseNotesCacheMinutes(v.date);
      await packageCache.set(
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
