import { Http } from '../../util/http';
// TODO - Move these types to issues/types.ts later
import type {
  EnsureIssueConfig,
  EnsureIssueResult,
  Issue,
} from '../platform/types';
import type { IssueCollectorAPI } from './types';

export type IssueCollectorId = 'jira';

export abstract class IssueCollector implements IssueCollectorAPI {
  protected constructor(public readonly id: string) {
    this.http = new Http(id);
  }

  protected http: Http;

  abstract getIssue?(number: number, useCache?: boolean): Promise<Issue | null>;

  abstract findIssue(title: string): Promise<Issue | null>;

  abstract getIssueList(): Promise<Issue[]>;

  abstract ensureIssue(
    ensureIssueConfig: EnsureIssueConfig
  ): Promise<EnsureIssueResult | null>;

  abstract ensureIssueClosing(title: string): Promise<void>;

  abstract massageMarkdown(prBody: string): string;
}
