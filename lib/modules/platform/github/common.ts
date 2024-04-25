import is from '@sindresorhus/is';
import { GithubHttp } from '../../../util/http/github';
import { getPrBodyStruct } from '../pr-body';
import type { GhPr, GhRestPr } from './types';

export const githubApi = new GithubHttp();

/**
 * @see https://docs.github.com/en/rest/reference/pulls#list-pull-requests
 */
export function coerceRestPr(pr: GhRestPr): GhPr {
  const bodyStruct = pr.bodyStruct ?? getPrBodyStruct(pr.body);
  const result: GhPr = {
    number: pr.number,
    sourceBranch: pr.head?.ref,
    title: pr.title,
    state:
      pr.state === 'closed' && is.string(pr.merged_at) ? 'merged' : pr.state,
    bodyStruct,
    updated_at: pr.updated_at,
    node_id: pr.node_id,
  };

  if (pr.head?.sha) {
    result.sha = pr.head.sha;
  }

  if (pr.head?.repo?.full_name) {
    result.sourceRepo = pr.head.repo.full_name;
  }

  if (pr.labels) {
    result.labels = pr.labels.map(({ name }) => name);
  }

  if (!!pr.assignee || is.nonEmptyArray(pr.assignees)) {
    result.hasAssignees = true;
  }

  if (pr.requested_reviewers) {
    result.reviewers = pr.requested_reviewers
      .map(({ login }) => login)
      .filter(is.nonEmptyString);
  }

  if (pr.created_at) {
    result.createdAt = pr.created_at;
  }

  if (pr.closed_at) {
    result.closedAt = pr.closed_at;
  }

  if (pr.base?.ref) {
    result.targetBranch = pr.base.ref;
  }

  return result;
}
