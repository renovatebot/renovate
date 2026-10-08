import { z } from 'zod/v4';
import { DockerDatasource } from '../../../datasource/docker/index.ts';
import type { ActionSchema, KnownActionConfig } from '../types.ts';
import { parseImageValue, parseValue } from './utils.ts';

const EcsRenderTaskDefinitionWith: ActionSchema = z
  .object({ image: z.string().optional() })
  .transform(({ image }) => [parseImageValue(image)]);

const renovateGithubActionDefaultImage = 'ghcr.io/renovatebot/renovate';
const RenovateGithubActionWith: ActionSchema = z
  .object({
    'renovate-version': z.string().optional(),
    'renovate-image': z.string().optional(),
  })
  .transform(({ 'renovate-version': version, 'renovate-image': image }) => {
    const [packageName, currentDigest] = (
      image ?? renovateGithubActionDefaultImage
    ).split('@');
    return [
      {
        packageName,
        ...(currentDigest ? { currentDigest } : {}),
        ...parseValue(version),
      },
    ];
  });

export const dockerDynamicActions: Record<string, KnownActionConfig> = {
  // https://github.com/aws-actions/amazon-ecs-render-task-definition
  'aws-actions/amazon-ecs-render-task-definition': {
    datasource: DockerDatasource.id,
    packageName: '', // determined from `image` input
    withSchema: EcsRenderTaskDefinitionWith,
  },
  // https://github.com/renovatebot/github-action
  'renovatebot/github-action': {
    datasource: DockerDatasource.id,
    packageName: '', // determined from `renovate-image` input, if set
    withSchema: RenovateGithubActionWith,
  },
};
