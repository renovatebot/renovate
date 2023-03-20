import is from '@sindresorhus/is';
import type { AllConfig } from '../../config/types';
import { ISSUE_COLLECTOR_NOT_FOUND } from '../../constants/error-messages';
import { Platform, getPlatforms } from '../platform';
import issueCollectors from './api';
import type { IssueCollector, IssueCollectorId } from './issue-collector';
import type { IssueCollectorAPI } from './types';

export const getIssueCollectorsList = (): string[] =>
  Array.from(issueCollectors.keys());
export const getIssueCollectors = (): Map<
  IssueCollectorId,
  IssueCollectorAPI
> => issueCollectors;

let _issueCollector: IssueCollectorAPI | Platform | undefined;

const handler: ProxyHandler<IssueCollector> = {
  get(_target: IssueCollectorAPI, prop: keyof IssueCollectorAPI) {
    if (!_issueCollector) {
      throw new Error(ISSUE_COLLECTOR_NOT_FOUND);
    }
    return _issueCollector[prop];
  },
};
export const issueCollector = new Proxy<IssueCollectorAPI>({} as any, handler);

export function initIssueCollector(config: AllConfig): void {
  setIssueCollectorApi(config);
}

function setIssueCollectorApi(config: AllConfig): void {
  if (is.nonEmptyString(config.issueCollector)) {
    if (!issueCollectors.has(config.issueCollector)) {
      throw new Error(
        `Init: Issue Collector "${
          config.issueCollector
        }" not found. Must be one of: ${getIssueCollectorsList().join(', ')}`
      );
    }

    _issueCollector = issueCollectors.get(config.issueCollector);
  } else if (
    is.nonEmptyString(config.platform) &&
    getPlatforms().has(config.platform)
  ) {
    _issueCollector = getPlatforms().get(config.platform);
  }
}
