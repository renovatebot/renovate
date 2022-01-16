import URL from 'url';
import is from '@sindresorhus/is';
import { DateTime } from 'luxon';
import MarkdownIt from 'markdown-it';
import { logger } from '../../../logger';
import * as memCache from '../../../util/cache/memory';
import * as packageCache from '../../../util/cache/package';
import { linkify } from '../../../util/markdown';
import { regEx } from '../../../util/regex';
import * as github from './github';
import * as gitlab from './gitlab';
import type {
  ChangeLogFile,
  ChangeLogNotes,
  ChangeLogProject,
  ChangeLogResult,
} from './types';

const markdown = new MarkdownIt('zero');
markdown.enable(['heading', 'lheading']);

export async function getReleaseList(
  project: ChangeLogProject
): Promise<ChangeLogNotes[]> {
  logger.trace('getReleaseList()');
  const { apiBaseUrl, repository, type } = project;
  try {
    switch (type) {
      case 'gitlab':
        return await gitlab.getReleaseList(apiBaseUrl, repository);
      case 'github':
        return await github.getReleaseList(apiBaseUrl, repository);

      default:
        logger.warn({ apiBaseUrl, repository, type }, 'Invalid project type');
        return [];
    }
  } catch (err) /* istanbul ignore next */ {
    if (err.statusCode === 404) {
      logger.debug({ repository, type, apiBaseUrl }, 'getReleaseList 404');
    } else {
      logger.debug(
        { repository, type, apiBaseUrl, err },
        'getReleaseList error'
      );
    }
  }
  return [];
}

export function getCachedReleaseList(
  project: ChangeLogProject
): Promise<ChangeLogNotes[]> {
  const cacheKey = `getReleaseList-${project.apiBaseUrl}-${project.repository}`;
  const cachedResult = memCache.get<Promise<ChangeLogNotes[]>>(cacheKey);
  // istanbul ignore if
  if (cachedResult !== undefined) {
    return cachedResult;
  }
  const promisedRes = getReleaseList(project);
  memCache.set(cacheKey, promisedRes);
  return promisedRes;
}

export function massageBody(
  input: string | undefined | null,
  baseUrl: string
): string {
  let body = input || '';
  // Convert line returns
  body = body.replace(regEx(/\r\n/g), '\n');
  // semantic-release cleanup
  body = body.replace(regEx(/^<a name="[^"]*"><\/a>\n/), '');
  body = body.replace(
    regEx(
      `^##? \\[[^\\]]*\\]\\(${baseUrl}[^/]*\\/[^/]*\\/compare\\/.*?\\n`,
      undefined,
      false
    ),
    ''
  );
  // Clean-up unnecessary commits link
  body = `\n${body}\n`.replace(
    regEx(`\\n${baseUrl}[^/]+\\/[^/]+\\/compare\\/[^\\n]+(\\n|$)`),
    '\n'
  );
  // Reduce headings size
  body = body
    .replace(regEx(/\n\s*####? /g), '\n##### ')
    .replace(regEx(/\n\s*## /g), '\n#### ')
    .replace(regEx(/\n\s*# /g), '\n### ');
  // Trim whitespace
  return body.trim();
}

export async function getReleaseNotes(
  project: ChangeLogProject,
  version: string
): Promise<ChangeLogNotes | null> {
  const { baseUrl, depName, repository } = project;
  logger.trace(`getReleaseNotes(${repository}, ${version}, ${depName})`);
  const releaseList = await getCachedReleaseList(project);
  logger.trace({ releaseList }, 'Release list from getReleaseList');
  let releaseNotes: ChangeLogNotes | null = null;
  for (const release of releaseList) {
    if (
      release.tag === version ||
      release.tag === `v${version}` ||
      release.tag === `${depName}-${version}` ||
      release.tag === `${depName}_v${version}` ||
      release.tag === `${depName}@${version}`
    ) {
      releaseNotes = release;
      releaseNotes.url = baseUrl.includes('gitlab')
        ? `${baseUrl}${repository}/tags/${release.tag}`
        : `${baseUrl}${repository}/releases/${release.tag}`;
      releaseNotes.body = massageBody(releaseNotes.body, baseUrl);
      if (releaseNotes.body.length) {
        try {
          if (baseUrl !== 'https://gitlab.com/') {
            releaseNotes.body = await linkify(releaseNotes.body, {
              repository: `${baseUrl}${repository}`,
            });
          }
        } catch (err) /* istanbul ignore next */ {
          logger.warn({ err, baseUrl, repository }, 'Error linkifying');
        }
      } else {
        releaseNotes = null;
      }
    }
  }
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
  project: ChangeLogProject
): Promise<ChangeLogFile> | null {
  const { apiBaseUrl, repository, sourceDirectory, type } = project;
  try {
    switch (type) {
      case 'gitlab':
        return await gitlab.getReleaseNotesMd(
          repository,
          apiBaseUrl,
          sourceDirectory
        );
      case 'github':
        return await github.getReleaseNotesMd(
          repository,
          apiBaseUrl,
          sourceDirectory
        );

      default:
        logger.warn({ apiBaseUrl, repository, type }, 'Invalid project type');
        return null;
    }
  } catch (err) /* istanbul ignore next */ {
    if (err.statusCode === 404) {
      logger.debug(
        { repository, type, apiBaseUrl },
        'Error 404 getting changelog md'
      );
    } else {
      logger.debug(
        { err, repository, type, apiBaseUrl },
        'Error getting changelog md'
      );
    }
  }
  return null;
}

export function getReleaseNotesMdFile(
  project: ChangeLogProject
): Promise<ChangeLogFile | null> {
  const cacheKey = `getReleaseNotesMdFile@v2-${project.repository}${
    project.sourceDirectory ? `-${project.sourceDirectory}` : ''
  }-${project.apiBaseUrl}`;
  const cachedResult = memCache.get<Promise<ChangeLogFile | null>>(cacheKey);
  // istanbul ignore if
  if (cachedResult !== undefined) {
    return cachedResult;
  }
  const promisedRes = getReleaseNotesMdFileInner(project);
  memCache.set(cacheKey, promisedRes);
  return promisedRes;
}

export async function getReleaseNotesMd(
  project: ChangeLogProject,
  version: string
): Promise<ChangeLogNotes | null> {
  const { baseUrl, repository } = project;
  logger.trace(`getReleaseNotesMd(${repository}, ${version})`);
  const skippedRepos = ['facebook/react-native'];
  // istanbul ignore if
  if (skippedRepos.includes(repository)) {
    return null;
  }
  const changelog = await getReleaseNotesMdFile(project);
  if (!changelog) {
    return null;
  }
  const { changelogFile } = changelog;
  const changelogMd = changelog.changelogMd.replace(
    regEx(/\n\s*<a name="[^"]*">.*?<\/a>\n/g),
    '\n'
  );
  for (const level of [1, 2, 3, 4, 5, 6, 7]) {
    const changelogParsed = sectionize(changelogMd, level);
    if (changelogParsed.length >= 2) {
      for (const section of changelogParsed) {
        try {
          // replace brackets and parenthesis with space
          const deParenthesizedSection = section.replace(
            regEx(/[[\]()]/g),
            ' '
          );
          const [heading] = deParenthesizedSection.split('\n');
          const title = heading
            .replace(regEx(/^\s*#*\s*/), '')
            .split(' ')
            .filter(Boolean);
          let body = section.replace(regEx(/.*?\n(-{3,}\n)?/), '').trim();
          for (const word of title) {
            if (word.includes(version) && !isUrl(word)) {
              logger.trace({ body }, 'Found release notes for v' + version);
              // TODO: fix url
              const notesSourceUrl = `${baseUrl}${repository}/blob/HEAD/${changelogFile}`;
              const url =
                notesSourceUrl +
                '#' +
                title.join('-').replace(regEx(/[^A-Za-z0-9-]/g), '');
              body = massageBody(body, baseUrl);
              if (body?.length) {
                try {
                  body = await linkify(body, {
                    repository: `${baseUrl}${repository}`,
                  });
                } catch (err) /* istanbul ignore next */ {
                  logger.warn({ body, err }, 'linkify error');
                }
              }
              return {
                body,
                url,
                notesSourceUrl,
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
  if (!input?.versions || !input.project?.type) {
    logger.debug('Missing project or versions');
    return input;
  }
  const output: ChangeLogResult = { ...input, versions: [] };
  const { repository, sourceDirectory } = input.project;
  const cacheNamespace = `changelog-${input.project.type}-notes@v2`;
  function getCacheKey(version: string): string {
    return `${repository}:${
      sourceDirectory ? `${sourceDirectory}:` : ''
    }${version}`;
  }
  for (const v of input.versions) {
    let releaseNotes: ChangeLogNotes;
    const cacheKey = getCacheKey(v.version);
    releaseNotes = await packageCache.get(cacheNamespace, cacheKey);
    // istanbul ignore else: no cache tests
    if (!releaseNotes) {
      releaseNotes = await getReleaseNotesMd(input.project, v.version);
      // istanbul ignore else: should be tested
      if (!releaseNotes) {
        releaseNotes = await getReleaseNotes(input.project, v.version);
      }
      // Small hack to force display of release notes when there is a compare url
      if (!releaseNotes && v.compare.url) {
        releaseNotes = { url: v.compare.url, notesSourceUrl: '' };
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
