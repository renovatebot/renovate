import { logger } from '../../../logger/index.ts';
import { gitlabApi } from './http.ts';
import type { GitLabMergeRequest } from './schema.ts';
import type { UpdateMergeRequest } from './types.ts';

export async function getMR(
  repository: string,
  iid: number,
): Promise<GitLabMergeRequest> {
  logger.debug(`getMR(${iid})`);

  const url = `projects/${repository}/merge_requests/${iid}?include_diverged_commits_count=1`;
  return (await gitlabApi.getJsonUnchecked<GitLabMergeRequest>(url)).body;
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
