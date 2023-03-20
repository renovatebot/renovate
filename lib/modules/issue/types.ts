import type { ModuleApi } from '../../types';
import type {
  EnsureIssueConfig,
  EnsureIssueResult,
  Issue,
} from '../platform/types';

export interface IssueCollectorAPI extends ModuleApi {
  id: string;

  findIssue(title: string): Promise<Issue | null>;

  getIssue?(number: number, useCache?: boolean): Promise<Issue | null>;

  getIssueList(): Promise<Issue[]>;

  ensureIssue(
    issueConfig: EnsureIssueConfig
  ): Promise<EnsureIssueResult | null>;

  ensureIssueClosing(title: string): Promise<void>;

  massageMarkdown(prBody: string): string;
}
