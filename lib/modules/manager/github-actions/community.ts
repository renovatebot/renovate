import { z } from 'zod/v3';

import { escapeRegExp, regEx } from '../../../util/regex.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import { NpmDatasource } from '../../datasource/npm/index.ts';
import { PypiDatasource } from '../../datasource/pypi/index.ts';
import { RubyVersionDatasource } from '../../datasource/ruby-version/index.ts';
import * as condaVersioning from '../../versioning/conda/index.ts';
import * as npmVersioning from '../../versioning/npm/index.ts';
import type { PackageDependency } from '../types.ts';

export interface CommunityActionConfig {
  datasource: string;
  depName?: string;
  packageName: string;
  versioning?: string;
  extractVersion?: string;

  /**
   * should return `true` if the version is invalid and should be skipped
   */
  isInvalid?: (value: string) => boolean;

  withSchema?: z.ZodEffects<
    z.ZodTypeAny,
    { val: string | undefined } & Record<string, unknown>
  >;
}

type ActionSchema = z.ZodEffects<z.ZodTypeAny, PackageDependency>;

function actionSchema(
  name: string,
  { isInvalid, withSchema, ...cfg }: CommunityActionConfig,
): ActionSchema {
  return z
    .object({
      uses: matchAction(name),
      with: withSchema ?? VersionValSchema,
    })
    .transform(
      ({ with: { val, ...meta } }): PackageDependency => ({
        ...cfg,
        ...meta,
        ...parseValue(val, isInvalid),
      }),
    )
    .transform((dep) => {
      dep.depName ??= dep.packageName;
      return dep;
    });
}

function matchAction(action: string): z.ZodString {
  return z
    .string()
    .regex(regEx(`(?:https?://[^/]+/)?${escapeRegExp(action)}(?:@.+)?$`));
}

function parseValue(
  currentValue: string | undefined,
  isInvalid?: (val: string) => boolean,
): PackageDependency {
  if (!currentValue) {
    return {
      skipStage: 'extract',
      skipReason: 'unspecified-version',
      depType: 'uses-with',
    };
  }
  if (isInvalid?.(currentValue) === true) {
    return {
      skipStage: 'extract',
      skipReason: 'invalid-version',
      depType: 'uses-with',
      currentValue,
    };
  }
  return { currentValue, depType: 'uses-with' };
}

function valSchema(
  key: string,
): z.ZodEffects<z.ZodTypeAny, { val: string | undefined }> {
  return z
    .object({ [key]: z.string().optional() })
    .transform((val) => ({ val: val[key] }));
}

const VersionValSchema = z
  .object({ version: z.string().optional() })
  .transform((val) => ({ val: val.version }));

const InstallBinaryWithSchema = z
  .object({ repo: z.string(), tag: z.string() })
  .transform(({ repo, tag }) => ({ packageName: repo, val: tag }));

/**
 * Community contributed actions with known version input schemas.
 */
export const communityActions: Record<string, CommunityActionConfig> = {
  // https://github.com/aquasecurity/setup-trivy
  'aquasecurity/setup-trivy': {
    datasource: GithubReleasesDatasource.id,
    packageName: 'aquasecurity/trivy',
  },
  // https://github.com/aquasecurity/trivy-action
  'aquasecurity/trivy-action': {
    datasource: GithubReleasesDatasource.id,
    packageName: 'aquasecurity/trivy',
  },
  // https://github.com/astral-sh/setup-uv
  'astral-sh/setup-uv': {
    datasource: GithubReleasesDatasource.id,
    versioning: npmVersioning.id,
    packageName: 'astral-sh/uv',
  },
  'denoland/setup-deno': {
    datasource: NpmDatasource.id,
    packageName: 'deno',
    withSchema: valSchema('deno-version'),
  },
  'golangci/golangci-lint-action': {
    datasource: GithubReleasesDatasource.id,
    packageName: 'golangci/golangci-lint',
  },
  'jakebailey/pyright-action': {
    datasource: NpmDatasource.id,
    packageName: 'pyright',
    isInvalid: (val) => val === 'PATH',
  },
  'jaxxstorm/action-install-gh-release': {
    datasource: GithubReleasesDatasource.id,
    packageName: '', // determined from `repo` input
    withSchema: InstallBinaryWithSchema,
  },
  'oven-sh/setup-bun': {
    datasource: NpmDatasource.id,
    packageName: 'bun',
    withSchema: valSchema('bun-version'),
  },
  'pdm-project/setup-pdm': {
    datasource: PypiDatasource.id,
    packageName: 'pdm',
  },
  'pnpm/action-setup': {
    datasource: NpmDatasource.id,
    packageName: 'pnpm',
  },
  'prefix-dev/setup-pixi': {
    datasource: GithubReleasesDatasource.id,
    versioning: condaVersioning.id,
    packageName: 'prefix-dev/pixi',
    withSchema: valSchema('pixi-version'),
  },
  // https://github.com/pypa/hatch/tree/install
  'pypa/hatch': {
    datasource: GithubReleasesDatasource.id,
    packageName: 'pypa/hatch',
    // Strip hatch- prefix from release tags
    extractVersion: '^hatch-(?<version>.+)$',
  },
  'ruby/setup-ruby': {
    datasource: RubyVersionDatasource.id,
    packageName: 'ruby',
    withSchema: valSchema('ruby-version'),
  },
  'sigoden/install-binary': {
    datasource: GithubReleasesDatasource.id,
    packageName: '', // determined from `repo` input
    withSchema: InstallBinaryWithSchema,
  },
  'zizmorcore/zizmor-action': {
    datasource: DockerDatasource.id,
    packageName: 'ghcr.io/zizmorcore/zizmor',
  },
};

export const CommunityActions = z.union(
  Object.entries(communityActions).map(([name, cfg]) =>
    actionSchema(name, cfg),
  ) as [ActionSchema, ActionSchema, ...ActionSchema[]],
);
