import is from '@sindresorhus/is';
import { GitObjectType } from 'azure-devops-node-api/interfaces/GitInterfaces.js';
import changelogFilenameRegex from 'changelog-filename-regex';
import upath from 'upath';
import { logger } from '../../../../../../logger/index.ts';
import * as azureApi from '../../../../../../modules/platform/azure/azure-got-wrapper.ts';
import * as azureHelper from '../../../../../../modules/platform/azure/azure-helper.ts';
import * as memCache from '../../../../../../util/cache/memory/index.ts';
import { withCache } from '../../../../../../util/cache/package/with-cache.ts';
import { regEx } from '../../../../../../util/regex.ts';
import { coerceString } from '../../../../../../util/string.ts';
import {
  ensureTrailingSlash,
  joinUrlParts,
  parseUrl,
  trimSlashes,
} from '../../../../../../util/url.ts';
import type { BranchUpgradeConfig } from '../../../../../types.ts';
import { compareChangelogFilePath } from '../common.ts';
import { ChangeLogSource } from '../source.ts';
import type { ChangeLogFile, ChangeLogProject } from '../types.ts';

export const id = 'azure-changelog';

const repositoryPathRegex = regEx(
  /^(?<base>.+)\/_git\/(?<repository>[^/]+)\/?$/,
);

function getProject(apiBaseUrl: string): string {
  const match = regEx('/(?<project>[^/]+)/_apis/').exec(apiBaseUrl);
  try {
    return decodeURIComponent(coerceString(match?.groups?.project));
  } catch {
    return '';
  }
}

function getRepositoryPath(
  url: URL,
): { base: string; repository: string } | null {
  const groups = repositoryPathRegex.exec(url.pathname)?.groups;
  if (!groups) {
    return null;
  }
  const segmentCount = trimSlashes(groups.base).split('/').length;
  if (
    (url.hostname === 'dev.azure.com' && segmentCount !== 2) ||
    (url.hostname.endsWith('.visualstudio.com') && segmentCount !== 1)
  ) {
    return null;
  }
  return { base: groups.base, repository: groups.repository };
}

function normalizeOrganizationUrl(url: string): string {
  const parsedUrl = parseUrl(url);
  if (!parsedUrl) {
    return '';
  }
  if (parsedUrl.hostname.endsWith('.visualstudio.com')) {
    const organization = parsedUrl.hostname.slice(
      0,
      -'.visualstudio.com'.length,
    );
    return `https://dev.azure.com/${organization}`;
  }
  const pathname = trimSlashes(parsedUrl.pathname);
  const normalizedPath =
    parsedUrl.hostname === 'dev.azure.com' ? pathname.toLowerCase() : pathname;
  return `${parsedUrl.origin}${normalizedPath ? `/${normalizedPath}` : ''}`;
}

export class AzureChangeLogSource extends ChangeLogSource {
  constructor() {
    super('azure');
  }

  override getAllTags(endpoint: string, repository: string): Promise<string[]> {
    const project = getProject(endpoint);
    if (!project) {
      return Promise.resolve([]);
    }
    const key = `changelog-project-tags:${JSON.stringify([endpoint, repository])}`;
    const cached = memCache.get<Promise<string[]>>(key);
    if (!is.undefined(cached)) {
      return cached;
    }
    const result = withCache(
      {
        namespace: 'datasource-azure-tags',
        key,
        cacheable: false,
        fallback: true,
      },
      async () => {
        const client = await azureApi.gitApi();
        const tags = await client.getRefs(repository, project, 'tags');
        return tags.flatMap((tag) => (is.string(tag.name) ? [tag.name] : []));
      },
    ).catch((err: unknown) => {
      memCache.set(key, undefined);
      throw err;
    });
    memCache.set(key, result);
    return result;
  }

  override getNotesCacheKey(project: ChangeLogProject): string {
    return JSON.stringify([
      project.baseUrl,
      project.repository,
      project.sourceDirectory ?? '',
    ]);
  }

  protected override shouldSkipPackage(config: BranchUpgradeConfig): boolean {
    const baseUrl = this.getBaseUrl(config);
    const organizationUrl = baseUrl.replace(regEx(/\/[^/]+\/$/), '/');
    const endpoint = azureApi.getEndpoint();
    if (
      !baseUrl ||
      !endpoint ||
      normalizeOrganizationUrl(organizationUrl) !==
        normalizeOrganizationUrl(endpoint)
    ) {
      logger.debug(
        { sourceUrl: config.sourceUrl },
        'Skipping Azure changelog outside the configured organization',
      );
      return true;
    }
    return false;
  }

  async getReleaseNotesMd(
    repository: string,
    apiBaseUrl: string,
    sourceDirectory?: string,
  ): Promise<ChangeLogFile | null> {
    logger.trace('azure.getReleaseNotesMd()');

    const sourceDir = coerceString(sourceDirectory, '/');
    const project = getProject(apiBaseUrl);
    if (!project) {
      return null;
    }

    const sourceDirectoryId = await azureHelper.getItem(
      repository,
      sourceDir,
      project,
    );

    if (!is.string(sourceDirectoryId.objectId)) {
      logger.debug('no objectId found for source directory');
      return null;
    }

    const tree = await azureHelper.getTrees(
      repository,
      sourceDirectoryId.objectId,
      project,
    );

    const allFiles = tree.treeEntries?.filter(
      (f) => f.gitObjectType === GitObjectType.Blob,
    );

    if (!allFiles?.length) {
      logger.trace('no files found in repository');
      return null;
    }

    const files = allFiles.filter(
      (f): f is typeof f & { relativePath: string } =>
        is.string(f.relativePath) &&
        changelogFilenameRegex.test(upath.basename(f.relativePath)),
    );

    if (!files.length) {
      logger.trace('no changelog file found');
      return null;
    }

    let changelogFile = files
      .sort((a, b) => compareChangelogFilePath(a.relativePath, b.relativePath))
      .shift()!.relativePath;

    changelogFile = `${sourceDir ? ensureTrailingSlash(sourceDir) : ''}${changelogFile}`;

    const fileRes = await azureHelper.getItem(
      repository,
      changelogFile,
      project,
      true,
    );

    if (!fileRes?.content) {
      logger.trace('no changelog file found');
      return null;
    }

    const changelogMd = `${fileRes.content}\n#\n##`;
    return { changelogFile, changelogMd };
  }

  override getCompareURL(
    baseUrl: string,
    repository: string,
    prevHead: string,
    nextHead: string,
  ): string {
    const regex = regEx(`^refs/tags/`, undefined);
    return `${baseUrl}_git/${encodeURIComponent(repository)}/branchCompare?baseVersion=GT${prevHead.replace(
      regex,
      '',
    )}&targetVersion=GT${nextHead.replace(regex, '')}`;
  }

  override getBaseUrl(config: BranchUpgradeConfig): string {
    const parsedUrl = parseUrl(config.sourceUrl);
    if (is.nullOrUndefined(parsedUrl)) {
      return '';
    }
    const path = getRepositoryPath(parsedUrl);
    if (!path) {
      return '';
    }
    const protocol = parsedUrl.protocol.replace(regEx(/^git\+/), '');
    return `${protocol}//${parsedUrl.host}${path.base}/`;
  }

  override getAPIBaseUrl(config: BranchUpgradeConfig): string {
    const baseUrl = this.getBaseUrl(config);
    return baseUrl ? `${baseUrl}_apis/` : '';
  }

  override getRepositoryFromUrl(config: BranchUpgradeConfig): string {
    const parsedUrl = parseUrl(config.sourceUrl);
    if (is.nullOrUndefined(parsedUrl)) {
      return '';
    }
    const path = getRepositoryPath(parsedUrl);
    try {
      return decodeURIComponent(path?.repository ?? '');
    } catch {
      return '';
    }
  }

  override hasValidRepository(repository: string): boolean {
    return is.nonEmptyString(repository) && repository.split('/').length === 1;
  }

  override getNotesSourceUrl(
    baseUrl: string,
    repository: string,
    changelogFile: string,
  ): string {
    return joinUrlParts(
      baseUrl,
      '_git',
      encodeURIComponent(repository),
      '?path=',
      changelogFile,
    );
  }

  override getReleaseNotesMdAnchorUrl(
    notesSourceUrl: string,
    heading: string,
  ): string {
    const anchor = encodeURIComponent(
      heading
        .replace(regEx(/^\s*#*\s*/), '')
        .toLowerCase()
        .replace(regEx(/\s+/g), '-'),
    );
    return `${notesSourceUrl}&anchor=${anchor}`;
  }
}
