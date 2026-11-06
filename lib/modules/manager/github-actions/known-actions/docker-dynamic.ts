import { z } from 'zod/v4';
import { DockerDatasource } from '../../../datasource/docker/index.ts';
import { splitImageParts } from '../../dockerfile/extract.ts';
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
    // `renovate-image` may itself be tag- and/or digest-pinned (e.g.
    // `ghcr.io/renovatebot/renovate:44.104.2@sha256:...`), in which case its
    // own tag takes priority over the separate `renovate-version` input.
    const dep = splitImageParts(image ?? renovateGithubActionDefaultImage);
    return [
      {
        depType: 'uses-with',
        ...dep,
        ...(dep.currentValue ? {} : parseValue(version)),
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
