import { logger } from '../../../logger/index.ts';
import * as helper from './gitea-helper.ts';
import type { Label } from './schema.ts';
import type { GiteaLikeHttp, LabelListRepo } from './types.ts';

async function fetchRepoLabels(
  http: GiteaLikeHttp,
  repository: string,
): Promise<Label[]> {
  const labels = await helper.getRepoLabels(http, repository, {
    memCache: false,
  });
  logger.debug(`Retrieved ${labels.length} repo labels`);
  return labels;
}

async function fetchOrgLabels(
  http: GiteaLikeHttp,
  { isOrgRepo, orgName }: LabelListRepo,
): Promise<Label[]> {
  if (!isOrgRepo) {
    return [];
  }
  try {
    const labels = await helper.getOrgLabels(http, orgName, {
      memCache: false,
    });
    logger.debug(`Retrieved ${labels.length} org labels`);
    return labels;
  } catch (err) {
    // Will fail if owner of repo is not org
    logger.debug({ err }, `Unable to fetch organization labels`);
    return [];
  }
}

/**
 * Labels of the repository followed by the labels of its organization, if any.
 */
export async function fetchLabelList(
  http: GiteaLikeHttp,
  repo: LabelListRepo,
): Promise<Label[]> {
  const [repoLabels, orgLabels] = await Promise.all([
    fetchRepoLabels(http, repo.repository),
    fetchOrgLabels(http, repo),
  ]);
  return [...repoLabels, ...orgLabels];
}
