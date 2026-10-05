import is from '@sindresorhus/is';
import { GitObjectType } from 'azure-devops-node-api/interfaces/GitInterfaces.js';
import changelogFilenameRegex from 'changelog-filename-regex';
import upath from 'upath';
import { logger } from '../../../../../../logger/index.ts';
import * as azureHelper from '../../../../../../modules/platform/azure/azure-helper.ts';
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
import type { ChangeLogFile } from '../types.ts';

export const id = 'azure-changelog';

export class AzureChangeLogSource extends ChangeLogSource {
  constructor() {
    super('azure');
  }

  async getReleaseNotesMd(
    repository: string,
    apiBaseUrl: string,
    sourceDirectory?: string,
  ): Promise<ChangeLogFile | null> {
    logger.trace('azure.getReleaseNotesMd()');

    const sourceDir = coerceString(sourceDirectory, '/');
    const urlEncodedRepo = encodeURIComponent(repository);

    // Extract project name from API base URL (last path segment before "_apis/")
    const projectMatch = regEx('/(?<project>[^/]+)/_apis/').exec(apiBaseUrl);
    const project = coerceString(projectMatch?.groups?.project);

    const sourceDirectoryId = await azureHelper.getItem(
      urlEncodedRepo,
      sourceDir,
      project,
    );

    if (!is.string(sourceDirectoryId.objectId)) {
      logger.debug('no objectId found for source directory');
      return null;
    }

    const tree = await azureHelper.getTrees(
      urlEncodedRepo,
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
      urlEncodedRepo,
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
    return `${baseUrl}_git/${repository}/branchCompare?baseVersion=GT${prevHead.replace(
      regex,
      '',
    )}&targetVersion=GT${nextHead.replace(regex, '')}`;
  }

  override getBaseUrl(config: BranchUpgradeConfig): string {
    const parsedUrl = parseUrl(config.sourceUrl);
    if (is.nullOrUndefined(parsedUrl)) {
      return '';
    }
    const protocol = parsedUrl.protocol;
    const host = parsedUrl.host;
    const [organization, projectName] = parsedUrl.pathname.slice(1).split('/');
    return `${protocol}//${host}/${organization}/${projectName}/`;
  }

  override getAPIBaseUrl(config: BranchUpgradeConfig): string {
    return `${this.getBaseUrl(config)}_apis/`;
  }

  override getRepositoryFromUrl(config: BranchUpgradeConfig): string {
    const parsedUrl = parseUrl(config.sourceUrl);
    if (is.nullOrUndefined(parsedUrl)) {
      return '';
    }
    // Azure DevOps embeds the organization and project in the base URL, so the
    // repository is only the final path segment.
    return trimSlashes(parsedUrl.pathname).replace(regEx(/.*\//), '');
  }

  override hasValidRepository(repository: string): boolean {
    return repository.split('/').length === 1;
  }

  override getNotesSourceUrl(
    baseUrl: string,
    repository: string,
    changelogFile: string,
  ): string {
    return joinUrlParts(baseUrl, '_git', repository, '?path=', changelogFile);
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
