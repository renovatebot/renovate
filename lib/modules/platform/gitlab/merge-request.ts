import { logger } from '../../../logger';
import { gitlabApi } from './http';
import type { GitLabMergeRequest, UpdateMergeRequest } from './types';

export async function getMR(
  repository: string,
  iid: number,
): Promise<GitLabMergeRequest> {
  logger.debug(`getMR(${iid})`);

  const url = `projects/${repository}/merge_requests/${iid}?include_diverged_commits_count=1`;
  return (await gitlabApi.getJson<GitLabMergeRequest>(url)).body;
}

export async function updateMR(
  repository: string,
  iid: number,
  data: UpdateMergeRequest,
): Promise<void> {
  logger.debug(`updateMR(${iid})`);

  const url = `projects/${repository}/merge_requests/${iid}`;
  await gitlabApi.putJson(url, {
    body: data,
  });
}
