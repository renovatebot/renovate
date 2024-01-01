import { z } from 'zod';
import { Yaml } from '../../../util/schema-utils';

export interface HelmDockerImageDependencyBasic {
  registry?: string;
  repository: string;
}

export interface HelmDockerImageDependencyTag
  extends HelmDockerImageDependencyBasic {
  tag: string;
  version?: never;
}

export interface HelmDockerImageDependencyVersion
  extends HelmDockerImageDependencyBasic {
  version: string;
  tag?: never;
}

export type HelmDockerImageDependency =
  | HelmDockerImageDependencyTag
  | HelmDockerImageDependencyVersion;

export const ChartDefinition = z
  .object({
    apiVersion: z.string().regex(/v([12])/),
    name: z.string().min(1),
    version: z.string().regex(
      // Copied from https://semver.org/#is-there-a-suggested-regular-expression-regex-to-check-a-semver-string
      /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/,
    ),
  })
  .partial();
export type ChartDefinition = z.infer<typeof ChartDefinition>;

export const ChartDefinitionYaml = Yaml.pipe(ChartDefinition);
