import is from '@sindresorhus/is';
import { regEx } from '../../../../../../util/regex';
import { parseUrl } from '../../../../../../util/url';
import type { BranchUpgradeConfig } from '../../../../../types';
import { ChangeLogSource } from '../source';

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
    const regex = regEx(`^refs/tags/`, undefined, false);
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
    const pathname = parsedUrl.pathname;
    const organization = pathname.slice(1).split('/')[0];
    const projectName = pathname.slice(1).split('/')[1];
    return `${protocol}//${host}/${organization}/${projectName}/`;
  }

  override getAPIBaseUrl(config: BranchUpgradeConfig): string {
    return this.getBaseUrl(config) + '_apis/';
  }
}
