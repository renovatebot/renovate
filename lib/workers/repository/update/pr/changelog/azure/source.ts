import is from '@sindresorhus/is';
import { regEx } from '../../../../../../util/regex.ts';
import {
  joinUrlParts,
  parseUrl,
  trimSlashes,
} from '../../../../../../util/url.ts';
import type { BranchUpgradeConfig } from '../../../../../types.ts';
import { ChangeLogSource } from '../source.ts';

export class AzureChangeLogSource extends ChangeLogSource {
  constructor() {
    super('azure', 'azure-tags');
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
