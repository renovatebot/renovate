import { z } from 'zod/v4';

import { regEx } from '../../../util/regex.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import { GithubReleaseAttachmentsDatasource } from '../../datasource/github-release-attachments/index.ts';
import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import { NodeVersionDatasource } from '../../datasource/node-version/index.ts';
import { NpmDatasource } from '../../datasource/npm/index.ts';
import { PypiDatasource } from '../../datasource/pypi/index.ts';
import { RubyVersionDatasource } from '../../datasource/ruby-version/index.ts';
import { RustVersionDatasource } from '../../datasource/rust-version/index.ts';
import * as condaVersioning from '../../versioning/conda/index.ts';
import * as npmVersioning from '../../versioning/npm/index.ts';
import type { PackageDependency } from '../types.ts';

/**
 * Parses a step - or just its `with:` block - into the dependencies it
 * declares. Most actions declare a single one, but a step may yield several.
 */
export type ActionSchema = z.ZodType<PackageDependency[]>;

export interface CommunityActionConfig {
  datasource: string;
  depName?: string;
  packageName: string;
  versioning?: string;
  extractVersion?: string;

  /**
   * Parses the `with:` block, defaulting to the `version:` input.
   *
   * The fields above are applied to every dependency it yields, so a schema
   * which yields dependencies of more than one kind must set them itself.
   */
  withSchema?: ActionSchema;
}

export function actionSchema(
  name: string,
  { withSchema, ...cfg }: CommunityActionConfig,
): ActionSchema {
  return z
    .object({
      uses: matchAction(name),
      with: withSchema ?? VersionVal,
    })
    .transform(({ with: deps }) =>
      deps.map((dep) => {
        const merged = { ...cfg, ...dep };
        merged.depName ??= merged.packageName;
        return merged;
      }),
    );
}

function matchAction(action: string): z.ZodString {
  return z
    .string()
    .regex(regEx(`(?:https?://[^/]+/)?${RegExp.escape(action)}(?:@.+)?$`));
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

/**
 * A single dependency, versioned by the given `with:` input.
 *
 * @param isInvalid should return `true` if the version is invalid and should be skipped
 */
function valSchema(
  key: string,
  isInvalid?: (val: string) => boolean,
): ActionSchema {
  return z
    .object({ [key]: z.string().optional() })
    .transform((val) => [parseValue(val[key], isInvalid)]);
}

const VersionVal = valSchema('version');

const InstallBinaryWith: ActionSchema = z
  .object({ repo: z.string(), tag: z.string() })
  .transform(({ repo, tag }) => [{ packageName: repo, ...parseValue(tag) }]);

const sha256Regex = regEx(/^[a-f0-9]{64}$/);
const MiseWith: ActionSchema = z
  .object({
    version: z.string().optional(),
    sha256: z.string().optional(),
  })
  .transform(({ version, sha256 }) => [
    {
      ...parseValue(version),
      ...(sha256 && sha256Regex.test(sha256) ? { currentDigest: sha256 } : {}),
    },
  ]);

// Runtimes installable by `pnpm/setup`, keyed by the name used in its
// `runtime:` input. `bun` and `deno` reuse the datasources of their respective
// `setup-*` actions below.
const pnpmRuntimes: Record<string, PackageDependency | undefined> = {
  node: { datasource: NodeVersionDatasource.id, packageName: 'node' },
  bun: { datasource: NpmDatasource.id, packageName: 'bun' },
  deno: { datasource: NpmDatasource.id, packageName: 'deno' },
};

function parsePnpmRuntime(runtime: string | undefined): PackageDependency[] {
  if (!runtime) {
    return [];
  }

  // `<name>` or `<name>@<version>`, matching pnpm's `packageManager` field syntax
  const [name, version] = runtime.split('@');
  const cfg = pnpmRuntimes[name];
  if (!cfg) {
    return [
      {
        packageName: name || runtime,
        depType: 'uses-with',
        skipStage: 'extract',
        skipReason: 'invalid-name',
      },
    ];
  }

  return [{ ...cfg, ...parseValue(version) }];
}

const PnpmSetupWith: ActionSchema = z
  .object({
    version: z.string().optional(),
    runtime: z.string().optional(),
  })
  .transform(({ version, runtime }) => [
    parseValue(version),
    ...parsePnpmRuntime(runtime),
  ]);

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
  'azure/setup-helm': {
    datasource: GithubReleasesDatasource.id,
    depName: 'helm',
    packageName: 'helm/helm',
  },
  // https://github.com/azure/setup-helm
  'denoland/setup-deno': {
    datasource: NpmDatasource.id,
    packageName: 'deno',
    withSchema: valSchema('deno-version'),
  },
  // https://github.com/docker/setup-buildx-action
  'docker/setup-buildx-action': {
    datasource: GithubReleasesDatasource.id,
    depName: 'buildx',
    packageName: 'docker/buildx',
  },
  // https://github.com/docker/setup-compose-action
  'docker/setup-compose-action': {
    datasource: GithubReleasesDatasource.id,
    packageName: 'docker/compose',
  },
  // https://github.com/docker/setup-docker-action
  'docker/setup-docker-action': {
    datasource: GithubReleasesDatasource.id,
    depName: 'docker',
    packageName: 'moby/moby',
    extractVersion: '^docker-(?<version>.+)$',
  },
  // https://github.com/dtolnay/rust-toolchain
  'dtolnay/rust-toolchain': {
    datasource: RustVersionDatasource.id,
    packageName: 'rust',
    withSchema: valSchema('toolchain'),
  },
  'golangci/golangci-lint-action': {
    datasource: GithubReleasesDatasource.id,
    packageName: 'golangci/golangci-lint',
  },
  // https://github.com/helm/chart-testing-action
  'helm/chart-testing-action': {
    datasource: GithubReleasesDatasource.id,
    depName: 'chart-testing',
    packageName: 'helm/chart-testing',
  },
  'jakebailey/pyright-action': {
    datasource: NpmDatasource.id,
    packageName: 'pyright',
    withSchema: valSchema('version', (val) => val === 'PATH'),
  },
  'jaxxstorm/action-install-gh-release': {
    datasource: GithubReleasesDatasource.id,
    packageName: '', // determined from `repo` input
    withSchema: InstallBinaryWith,
  },
  'jdx/mise-action': {
    datasource: GithubReleaseAttachmentsDatasource.id,
    packageName: 'jdx/mise',
    withSchema: MiseWith,
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
  'pnpm/setup': {
    datasource: NpmDatasource.id,
    packageName: 'pnpm',
    withSchema: PnpmSetupWith,
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
    withSchema: InstallBinaryWith,
  },
  'sigstore/cosign-installer': {
    datasource: GithubReleasesDatasource.id,
    packageName: 'sigstore/cosign',
    withSchema: valSchema('cosign-release'),
  },
  'UpCloudLtd/upcloud-cli-action': {
    datasource: GithubReleasesDatasource.id,
    packageName: 'UpCloudLtd/upcloud-cli',
  },
  'zizmorcore/zizmor-action': {
    datasource: DockerDatasource.id,
    packageName: 'ghcr.io/zizmorcore/zizmor',
  },
};
