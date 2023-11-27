import is from '@sindresorhus/is';
import { DateTime } from 'luxon';
import MarkdownIt from 'markdown-it';
import { logger } from '../../../../../logger';
import * as memCache from '../../../../../util/cache/memory';
import * as packageCache from '../../../../../util/cache/package';
import { detectPlatform } from '../../../../../util/common';
import { linkify } from '../../../../../util/markdown';
import { newlineRegex, regEx } from '../../../../../util/regex';
import { coerceString } from '../../../../../util/string';
import { validateUrl } from '../../../../../util/url';
import type { BranchUpgradeConfig } from '../../../../types';
import * as bitbucket from './bitbucket';
import * as gitea from './gitea';
import * as github from './github';
import * as gitlab from './gitlab';
import type {
  ChangeLogFile,
  ChangeLogNotes,
  ChangeLogProject,
  ChangeLogRelease,
  ChangeLogResult,
} from './types';

const markdown = new MarkdownIt('zero');
markdown.enable(['heading', 'lheading']);

const repositoriesToSkipMdFetching = ['facebook/react-native'];

export async function getReleaseList(
  project: ChangeLogProject,
  release: ChangeLogRelease,
): Promise<ChangeLogNotes[]> {
  logger.trace('getReleaseList()');
  const { apiBaseUrl, repository, type } = project;
  try {
    switch (type) {
      case 'gitea':
        return await gitea.getReleaseList(project, release);
      case 'gitlab':
        return await gitlab.getReleaseList(project, release);
      case 'github':
        return await github.getReleaseList(project, release);
      case 'bitbucket':
        return bitbucket.getReleaseList(project, release);
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
        'getReleaseList error',
      );
    }
  }
  return [];
}

export function getCachedReleaseList(
  project: ChangeLogProject,
  release: ChangeLogRelease,
): Promise<ChangeLogNotes[]> {
  const { repository, apiBaseUrl } = project;
  // TODO: types (#22198)
  const cacheKey = `getReleaseList-${apiBaseUrl}-${repository}`;
  const cachedResult = memCache.get<Promise<ChangeLogNotes[]>>(cacheKey);
  // istanbul ignore if
  if (cachedResult !== undefined) {
    return cachedResult;
  }
  const promisedRes = getReleaseList(project, release);
  memCache.set(cacheKey, promisedRes);
  return promisedRes;
}

export function massageBody(
  input: string | undefined | null,
  baseUrl: string,
): string {
  let body = coerceString(input);
  // Convert line returns
  body = body.replace(regEx(/\r\n/g), '\n');
  // semantic-release cleanup
  body = body.replace(regEx(/^<a name="[^"]*"><\/a>\n/), '');
  body = body.replace(
    regEx(
      `^##? \\[[^\\]]*\\]\\(${baseUrl}[^/]*/[^/]*/compare/.*?\\n`,
      undefined,
      false,
    ),
    '',
  );
  // Clean-up unnecessary commits link
  body = `\n${body}\n`.replace(
    regEx(`\\n${baseUrl}[^/]+/[^/]+/compare/[^\\n]+(\\n|$)`),
    '\n',
  );
  // Reduce headings size
  body = body
    .replace(regEx(/\n\s*####? /g), '\n##### ')
    .replace(regEx(/\n\s*## /g), '\n#### ')
    .replace(regEx(/\n\s*# /g), '\n### ');
  // Trim whitespace
  return body.trim();
}

export function massageName(
  input: string | undefined | null,
  version: string | undefined,
): string | undefined {
  let name = input ?? '';

  if (version) {
    name = name.replace(RegExp(`^(Release )?v?${version}`, 'i'), '').trim();
  }

  name = name.trim();
  if (!name.length) {
    return undefined;
  }

  return name;
}

export async function getReleaseNotes(
  project: ChangeLogProject,
  release: ChangeLogRelease,
  config: BranchUpgradeConfig,
): Promise<ChangeLogNotes | null> {
  const { packageName, repository } = project;
  const { version, gitRef } = release;
  // TODO: types (#22198)
  logger.trace(`getReleaseNotes(${repository}, ${version}, ${packageName!})`);
  const releases = await getCachedReleaseList(project, release);
  logger.trace({ releases }, 'Release list from getReleaseList');
  let releaseNotes: ChangeLogNotes | null = null;

  let matchedRelease = getExactReleaseMatch(packageName!, version, releases);
  if (is.undefined(matchedRelease)) {
    // no exact match of a release then check other cases
    matchedRelease = releases.find(
      (r) =>
        r.tag === version ||
        r.tag === `v${version}` ||
        r.tag === gitRef ||
        r.tag === `v${gitRef}`,
    );
  }
  if (is.undefined(matchedRelease) && config.extractVersion) {
    const extractVersionRegEx = regEx(config.extractVersion);
    matchedRelease = releases.find((r) => {
      const extractedVersion = extractVersionRegEx.exec(r.tag!)?.groups
        ?.version;
      return version === extractedVersion;
    });
  }
  releaseNotes = await releaseNotesResult(matchedRelease, project);
  logger.trace({ releaseNotes });
  return releaseNotes;
}

function getExactReleaseMatch(
  packageName: string,
  version: string,
  releases: ChangeLogNotes[],
): ChangeLogNotes | undefined {
  const exactReleaseReg = regEx(`${packageName}[@_-]v?${version}`);
  const candidateReleases = releases.filter((r) => r.tag?.endsWith(version));
  const matchedRelease = candidateReleases.find((r) =>
    exactReleaseReg.test(r.tag!),
  );
  return matchedRelease;
}

async function releaseNotesResult(
  releaseMatch: ChangeLogNotes | undefined,
  project: ChangeLogProject,
): Promise<ChangeLogNotes | null> {
  if (!releaseMatch) {
    return null;
  }
  const { baseUrl, repository } = project;
  const releaseNotes: ChangeLogNotes = releaseMatch;
  if (detectPlatform(baseUrl) === 'gitlab') {
    releaseNotes.url = `${baseUrl}${repository}/tags/${releaseMatch.tag!}`;
  } else {
    releaseNotes.url = releaseMatch.url
      ? releaseMatch.url
      : /* istanbul ignore next */
        `${baseUrl}${repository}/releases/${releaseMatch.tag!}`;
  }
  // set body for release notes
  releaseNotes.body = massageBody(releaseNotes.body, baseUrl);
  releaseNotes.name = massageName(releaseNotes.name, releaseNotes.tag);
  if (releaseNotes.body.length || releaseNotes.name?.length) {
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
    return null;
  }

  return releaseNotes;
}

function sectionize(text: string, level: number): string[] {
  const sections: [number, number][] = [];
  const lines = text.split(newlineRegex);
  const tokens = markdown.parse(text, undefined);
  tokens.forEach((token) => {
    if (token.type === 'heading_open') {
      const lev = +token.tag.substring(1);
      if (lev <= level) {
        sections.push([lev, token.map![0]]);
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

export async function getReleaseNotesMdFileInner(
  project: ChangeLogProject,
): Promise<ChangeLogFile | null> {
  const { repository, type } = project;
  const apiBaseUrl = project.apiBaseUrl;
  const sourceDirectory = project.sourceDirectory!;
  try {
    switch (type) {
      case 'gitea':
        return await gitea.getReleaseNotesMd(
          repository,
          apiBaseUrl,
          sourceDirectory,
        );
      case 'gitlab':
        return await gitlab.getReleaseNotesMd(
          repository,
          apiBaseUrl,
          sourceDirectory,
        );
      case 'github':
        return await github.getReleaseNotesMd(
          repository,
          apiBaseUrl,
          sourceDirectory,
        );
      case 'bitbucket':
        return await bitbucket.getReleaseNotesMd(
          repository,
          apiBaseUrl,
          sourceDirectory,
        );
      default:
        logger.warn({ apiBaseUrl, repository, type }, 'Invalid project type');
        return null;
    }
  } catch (err) /* istanbul ignore next */ {
    if (err.statusCode === 404) {
      logger.debug(
        { repository, type, apiBaseUrl },
        'Error 404 getting changelog md',
      );
    } else {
      logger.debug(
        { err, repository, type, apiBaseUrl },
        'Error getting changelog md',
      );
    }
  }
  return null;
}

export function getReleaseNotesMdFile(
  project: ChangeLogProject,
): Promise<ChangeLogFile | null> {
  const { sourceDirectory, repository, apiBaseUrl } = project;
  // TODO: types (#22198)
  const cacheKey = sourceDirectory
    ? `getReleaseNotesMdFile@v2-${repository}-${sourceDirectory}-${apiBaseUrl}`
    : `getReleaseNotesMdFile@v2-${repository}-${apiBaseUrl}`;
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
  release: ChangeLogRelease,
): Promise<ChangeLogNotes | null> {
  const { baseUrl, repository } = project;
  const version = release.version;
  logger.trace(`getReleaseNotesMd(${repository}, ${version})`);

  if (shouldSkipChangelogMd(repository)) {
    return null;
  }

  const changelog = await getReleaseNotesMdFile(project);
  if (!changelog) {
    return null;
  }
  const { changelogFile } = changelog;
  const changelogMd = changelog.changelogMd.replace(
    regEx(/\n\s*<a name="[^"]*">.*?<\/a>\n/g),
    '\n',
  );
  for (const level of [1, 2, 3, 4, 5, 6, 7]) {
    const changelogParsed = sectionize(changelogMd, level);
    if (changelogParsed.length >= 2) {
      for (const section of changelogParsed) {
        try {
          // replace brackets and parenthesis with space
          const deParenthesizedSection = section.replace(
            regEx(/[[\]()]/g),
            ' ',
          );
          const [heading] = deParenthesizedSection.split(newlineRegex);
          const title = heading
            .replace(regEx(/^\s*#*\s*/), '')
            .split(' ')
            .filter(Boolean);
          let body = section.replace(regEx(/.*?\n(-{3,}\n)?/), '').trim();
          for (const word of title) {
            if (word.includes(version) && !validateUrl(word)) {
              logger.trace({ body }, 'Found release notes for v' + version);
              // TODO: fix url
              const notesSourceUrl = `${baseUrl}${repository}/blob/HEAD/${changelogFile}`;
              const mdHeadingLink = title
                .filter((word) => !validateUrl(word))
                .join('-')
                .replace(regEx(/[^A-Za-z0-9-]/g), '');
              const url = `${notesSourceUrl}#${mdHeadingLink}`;
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
          logger.warn(
            { file: changelogFile, err },
            `Error parsing changelog file`,
          );
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
    : DateTime.fromISO(releaseDate!);

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
  input: ChangeLogResult | null | undefined,
  config: BranchUpgradeConfig,
): Promise<ChangeLogResult | null> {
  if (!input?.versions || !input.project?.type) {
    logger.debug('Missing project or versions');
    return input ?? null;
  }
  const output: ChangeLogResult = {
    ...input,
    versions: [],
    hasReleaseNotes: false,
  };

  const { repository, sourceDirectory, type: projectType } = input.project;
  const cacheNamespace = `changelog-${projectType}-notes@v2`;
  const cacheKeyPrefix = sourceDirectory
    ? `${repository}:${sourceDirectory}`
    : `${repository}`;

  for (const v of input.versions) {
    let releaseNotes: ChangeLogNotes | null | undefined;
    const cacheKey = `${cacheKeyPrefix}:${v.version}`;
    releaseNotes = await packageCache.get(cacheNamespace, cacheKey);
    releaseNotes ??= await getReleaseNotesMd(input.project, v);
    releaseNotes ??= await getReleaseNotes(input.project, v, config);

    // If there is no release notes, at least try to show the compare URL
    if (!releaseNotes && v.compare.url) {
      releaseNotes = { url: v.compare.url, notesSourceUrl: '' };
    }

    const cacheMinutes = releaseNotesCacheMinutes(v.date);
    await packageCache.set(
      cacheNamespace,
      cacheKey,
      releaseNotes,
      cacheMinutes,
    );
    output.versions!.push({
      ...v,
      releaseNotes: releaseNotes!,
    });

    if (releaseNotes) {
      output.hasReleaseNotes = true;
    }
  }
  return output;
}

/**
 * Skip fetching changelog/release-notes markdown files.
 * Will force a fallback to using GitHub release notes
 */
export function shouldSkipChangelogMd(repository: string): boolean {
  return repositoriesToSkipMdFetching.includes(repository);
}
