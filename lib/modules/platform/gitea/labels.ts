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
async function fetchLabelList(
  http: GiteaLikeHttp,
  repo: LabelListRepo,
): Promise<Label[]> {
  const [repoLabels, orgLabels] = await Promise.all([
    fetchRepoLabels(http, repo.repository),
    fetchOrgLabels(http, repo),
  ]);
  return [...repoLabels, ...orgLabels];
}

/**
 * Cached labels of the repository. The lookup is stored on the repository,
 * so resetting `labelList` to `null` refetches the labels on next use.
 */
export function getLabelList(
  http: GiteaLikeHttp,
  repo: LabelListRepo,
): Promise<Label[]> {
  repo.labelList ??= fetchLabelList(http, repo);

  return repo.labelList;
}

export async function lookupLabelByName(
  http: GiteaLikeHttp,
  repo: LabelListRepo,
  name: string,
): Promise<number | null> {
  logger.debug(`lookupLabelByName(${name})`);
  const labelList = await getLabelList(http, repo);
  return labelList.find((l) => l.name === name)?.id ?? null;
}
