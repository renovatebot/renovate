import { z } from 'zod/v4';

import { regEx } from '../../../util/regex.ts';
import { CrateDatasource } from '../../datasource/crate/index.ts';
import { DartVersionDatasource } from '../../datasource/dart-version/index.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import { DotnetVersionDatasource } from '../../datasource/dotnet-version/index.ts';
import { GithubReleaseAttachmentsDatasource } from '../../datasource/github-release-attachments/index.ts';
import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import { GradleVersionDatasource } from '../../datasource/gradle-version/index.ts';
import { JavaVersionDatasource } from '../../datasource/java-version/index.ts';
import { NodeVersionDatasource } from '../../datasource/node-version/index.ts';
import { NpmDatasource } from '../../datasource/npm/index.ts';
import { PypiDatasource } from '../../datasource/pypi/index.ts';
import { RubyVersionDatasource } from '../../datasource/ruby-version/index.ts';
import { RustVersionDatasource } from '../../datasource/rust-version/index.ts';
import * as condaVersioning from '../../versioning/conda/index.ts';
import * as gradleVersioning from '../../versioning/gradle/index.ts';
import * as nodeVersioning from '../../versioning/node/index.ts';
import * as npmVersioning from '../../versioning/npm/index.ts';
import { splitImageParts } from '../dockerfile/extract.ts';
import type { PackageDependency } from '../types.ts';
import type { ActionSchema, KnownActionConfig } from './types.ts';

export function actionSchema(
  name: string,
  { withSchema, ...cfg }: KnownActionConfig,
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

/**
 * A single dependency, versioned by the given `with:` input, where some
 * documented literal values (e.g. `latest`, `nightly`) are present-but-not-
 * pinnable rather than an actual error.
 */
function valSchemaSkippingLiterals(
  key: string,
  literals: ReadonlySet<string>,
): ActionSchema {
  return z.object({ [key]: z.string().optional() }).transform((val) => {
    const value = val[key];
    if (value && literals.has(value)) {
      return [
        {
          currentValue: value,
          depType: 'uses-with',
          skipStage: 'extract',
          skipReason: 'unsupported-version',
        },
      ];
    }
    return [parseValue(value)];
  });
}

// Shared by the `actions/setup-{go,node,python}` entries below, whose
// releases are published as `actions/{go,node,python}-versions` GitHub
// releases, tagged like `20.11.0` or `20.11.0-1` (a build number suffix).
const actionsVersionsExtractVersion =
  '^(?<version>\\d+\\.\\d+\\.\\d+)(-\\d+)?$';

// `actions-rust-lang/setup-rust-toolchain`'s `toolchain` input is a
// comma-separated list of toolchains; only the LAST one becomes the active
// default toolchain, so that's the only one worth tracking.
const SetupRustToolchainWith: ActionSchema = z
  .object({ toolchain: z.string().optional() })
  .transform(({ toolchain }) => [
    parseValue(toolchain?.split(',').pop()?.trim()),
  ]);

const InstallBinaryWith: ActionSchema = z
  .object({ repo: z.string(), tag: z.string() })
  .transform(({ repo, tag }) => [{ packageName: repo, ...parseValue(tag) }]);

// Same shape as `InstallBinaryWith` above, but the package name comes from
// a crates.io crate name rather than a GitHub repo. `version` has a default
// (`'latest'`), so real workflows commonly omit it from `with:` entirely.
const CargoInstallWith: ActionSchema = z
  .object({ crate: z.string(), version: z.string().optional() })
  .transform(({ crate, version }) => [
    { packageName: crate, ...parseValue(version) },
  ]);

function parseImageValue(image: string | undefined): PackageDependency {
  if (!image) {
    return {
      depType: 'uses-with',
      skipStage: 'extract',
      skipReason: 'unspecified-version',
    };
  }

  const dep = splitImageParts(image);
  return {
    depType: 'uses-with',
    ...dep,
    ...(dep.skipReason ? { skipStage: 'extract' } : {}),
  };
}

const EcsRenderTaskDefinitionWith: ActionSchema = z
  .object({ image: z.string().optional() })
  .transform(({ image }) => [parseImageValue(image)]);

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

// Distributions whose version numbering we can reliably track via the
// java-version datasource (which sources releases from Adoptium/Eclipse
// Temurin). Other distributions may not follow the same release cadence
// or versioning, so we don't attempt to track them.
const supportedJavaDistributions = new Set(['temurin', 'adopt']);

const SetupJavaWith: ActionSchema = z
  .object({
    distribution: z.string().optional(),
    'java-version': z.string().optional(),
    'java-package': z.string().optional(),
  })
  .transform(
    ({
      distribution,
      'java-version': version,
      'java-package': javaPackage,
    }) => {
      const packageName = javaPackage?.startsWith('jre')
        ? 'java-jre'
        : 'java-jdk';

      if (
        !distribution ||
        !supportedJavaDistributions.has(distribution.toLowerCase())
      ) {
        return [
          {
            packageName,
            depType: 'uses-with',
            skipStage: 'extract',
            skipReason: 'unsupported',
          },
        ];
      }

      return [{ packageName, ...parseValue(version) }];
    },
  );

// `'latest'` is a valid, documented value for `tflint_version` (it's also the
// action's own default), but it isn't a version we can pin/bump, so treat it
// as present-but-unsupported rather than as an invalid value.
const TflintWith: ActionSchema = z
  .object({ tflint_version: z.string().optional() })
  .transform(({ tflint_version: version }) => {
    if (version === 'latest') {
      return [
        {
          currentValue: version,
          depType: 'uses-with',
          skipStage: 'extract',
          skipReason: 'unsupported-version',
        },
      ];
    }
    return [parseValue(version)];
  });

// `'latest'` is a valid, documented value for `version` (it's also the
// action's own default), but it isn't a version we can pin/bump, so treat it
// as present-but-unsupported rather than as an invalid value.
const SetupKubectlWith: ActionSchema = z
  .object({ version: z.string().optional() })
  .transform(({ version }) => {
    if (version === 'latest') {
      return [
        {
          currentValue: version,
          depType: 'uses-with',
          skipStage: 'extract',
          skipReason: 'unsupported-version',
        },
      ];
    }
    return [parseValue(version)];
  });

// `helm/kind-action` can yield up to 3 dependencies from a single step: the
// `kind` binary itself, the `kindest/node` image it boots, and (optionally) a
// pinned `kubectl` binary. All 3 inputs are optional, so only emit a
// dependency for the ones a workflow actually sets.
const KindActionWith: ActionSchema = z
  .object({
    version: z.string().optional(),
    node_image: z.string().optional(),
    kubectl_version: z.string().optional(),
  })
  .transform(({ version, node_image, kubectl_version }) => {
    const deps: PackageDependency[] = [];

    if (version) {
      deps.push({
        packageName: 'kubernetes-sigs/kind',
        ...parseValue(version),
      });
    }

    if (node_image) {
      // `node_image` may be pinned by digest (e.g.
      // `kindest/node:v1.31.0@sha256:...`), so reuse the same Docker
      // image-reference parsing as `aws-actions/amazon-ecs-render-task-definition`
      // rather than naively splitting on `:`.
      deps.push({
        datasource: DockerDatasource.id,
        ...parseImageValue(node_image),
      });
    }

    if (kubectl_version) {
      deps.push({
        packageName: 'kubernetes/kubernetes',
        ...parseValue(kubectl_version),
      });
    }

    return deps;
  });

// `erlef/setup-beam` can yield up to 4 dependencies from a single step: OTP,
// Elixir, Gleam, and rebar3. All inputs are optional, so only emit a
// dependency for the ones a workflow actually sets.
const ErlefSetupBeamWith: ActionSchema = z
  .object({
    'otp-version': z.string().optional(),
    'elixir-version': z.string().optional(),
    'gleam-version': z.string().optional(),
    'rebar3-version': z.string().optional(),
  })
  .transform(
    ({
      'otp-version': otpVersion,
      'elixir-version': elixirVersion,
      'gleam-version': gleamVersion,
      'rebar3-version': rebar3Version,
    }) => {
      const deps: PackageDependency[] = [];

      if (otpVersion) {
        // `false` is a valid, documented value (used to skip installing OTP
        // for Gleam-only workflows), but not one we can pin/bump
        deps.push(
          otpVersion === 'false'
            ? {
                packageName: 'erlang/otp',
                currentValue: otpVersion,
                depType: 'uses-with',
                skipStage: 'extract',
                skipReason: 'unsupported-version',
              }
            : {
                packageName: 'erlang/otp',
                // erlang/otp tags releases like `OTP-27.1.2`
                extractVersion: '^OTP-(?<version>.+)$',
                ...parseValue(otpVersion),
              },
        );
      }

      if (elixirVersion) {
        deps.push({
          packageName: 'elixir-lang/elixir',
          ...parseValue(elixirVersion),
        });
      }

      if (gleamVersion) {
        deps.push({
          packageName: 'gleam-lang/gleam',
          ...parseValue(gleamVersion),
        });
      }

      if (rebar3Version) {
        // `nightly` is a valid, documented value, but not one we can pin/bump
        deps.push(
          rebar3Version === 'nightly'
            ? {
                packageName: 'erlang/rebar3',
                currentValue: rebar3Version,
                depType: 'uses-with',
                skipStage: 'extract',
                skipReason: 'unsupported-version',
              }
            : { packageName: 'erlang/rebar3', ...parseValue(rebar3Version) },
        );
      }

      return deps;
    },
  );

// `graalvm/setup-graalvm` can yield up to 2 dependencies from a single step:
// the JDK version it's built on, and the GraalVM distribution version
// itself. Both inputs are optional, so only emit a dependency for the ones
// a workflow actually sets.
//
// `graalvm/graalvm-ce-builds` has used several tag-naming conventions over
// its history (`vm-ce-`, `vm-`, `jdk-`, `graal-`), and still alternates
// between `jdk-` and `graal-` prefixes for releases after GraalVM's 2023
// unification with JDK versioning, so we match both of those current-era
// prefixes rather than either one alone.
const GraalvmSetupWith: ActionSchema = z
  .object({
    'java-version': z.string().optional(),
    version: z.string().optional(),
  })
  .transform(({ 'java-version': javaVersion, version }) => {
    const deps: PackageDependency[] = [];

    if (javaVersion) {
      deps.push({
        datasource: JavaVersionDatasource.id,
        packageName: 'java-jdk',
        ...parseValue(javaVersion),
      });
    }

    if (version) {
      deps.push({
        datasource: GithubReleasesDatasource.id,
        packageName: 'graalvm/graalvm-ce-builds',
        extractVersion: '^(?:jdk|graal)-(?<version>.+)$',
        ...parseValue(version),
      });
    }

    return deps;
  });

// `moonrepo/setup-toolchain` can yield up to 2 dependencies from a single
// step: the `moon` binary and the `proto` binary. Both inputs are optional,
// so only emit a dependency for the ones a workflow actually sets.
const MoonrepoSetupToolchainWith: ActionSchema = z
  .object({
    'moon-version': z.string().optional(),
    'proto-version': z.string().optional(),
  })
  .transform(
    ({ 'moon-version': moonVersion, 'proto-version': protoVersion }) => {
      const deps: PackageDependency[] = [];

      if (moonVersion) {
        deps.push({
          packageName: 'moonrepo/moon',
          ...parseValue(moonVersion),
        });
      }

      if (protoVersion) {
        deps.push({
          packageName: 'moonrepo/proto',
          ...parseValue(protoVersion),
        });
      }

      return deps;
    },
  );

// `crystal-lang/install-crystal` can yield up to 2 dependencies from a
// single step: the Crystal compiler itself, and the shards package manager.
// Both inputs are optional, so only emit a dependency for the ones a
// workflow actually sets.
const InstallCrystalWith: ActionSchema = z
  .object({
    crystal: z.string().optional(),
    shards: z.string().optional(),
  })
  .transform(({ crystal, shards }) => {
    const deps: PackageDependency[] = [];

    if (crystal) {
      deps.push({
        packageName: 'crystal-lang/crystal',
        ...parseValue(crystal),
      });
    }

    if (shards) {
      deps.push({
        packageName: 'crystal-lang/shards',
        ...parseValue(shards),
      });
    }

    return deps;
  });

// `conda-incubator/setup-miniconda` exposes 6 separate version inputs
// (`miniconda-version`, `miniforge-version`, `conda-version`,
// `conda-build-version`, `python-version`, `mamba-version`), but only 2 map
// onto a datasource we can reliably use: `miniforge-version` (GitHub
// releases of `conda-forge/miniforge`) and `python-version` (the same
// `actions/python-versions` releases already used for `actions/setup-python`).
// The other 4 are versioned via anaconda.org channels or an installer
// archive with no clean Renovate datasource, so they're intentionally not
// tracked. Both supported inputs are optional, so only emit a dependency
// for the ones a workflow actually sets.
const SetupMinicondaWith: ActionSchema = z
  .object({
    'miniforge-version': z.string().optional(),
    'python-version': z.string().optional(),
  })
  .transform(
    ({
      'miniforge-version': miniforgeVersion,
      'python-version': pythonVersion,
    }) => {
      const deps: PackageDependency[] = [];

      if (miniforgeVersion) {
        deps.push({
          datasource: GithubReleasesDatasource.id,
          depName: 'miniforge',
          packageName: 'conda-forge/miniforge',
          ...parseValue(miniforgeVersion),
        });
      }

      if (pythonVersion) {
        deps.push({
          datasource: GithubReleasesDatasource.id,
          depName: 'python',
          packageName: 'actions/python-versions',
          versioning: npmVersioning.id,
          extractVersion: actionsVersionsExtractVersion,
          ...parseValue(pythonVersion),
        });
      }

      return deps;
    },
  );

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

/**
 * Community-maintained and first-party (GitHub's own `actions/*`) Actions
 * with known version input schemas.
 */
export const knownActions: Record<string, KnownActionConfig> = {
  // https://github.com/abatilo/actions-poetry
  'abatilo/actions-poetry': {
    datasource: PypiDatasource.id,
    packageName: 'poetry',
    withSchema: valSchema('poetry-version'),
  },
  // https://github.com/actions-rust-lang/setup-rust-toolchain
  'actions-rust-lang/setup-rust-toolchain': {
    datasource: RustVersionDatasource.id,
    packageName: 'rust',
    withSchema: SetupRustToolchainWith,
  },
  // https://github.com/actions/setup-dotnet
  'actions/setup-dotnet': {
    datasource: DotnetVersionDatasource.id,
    packageName: 'dotnet-sdk',
    withSchema: valSchema('dotnet-version', (val) => val.includes('\n')),
  },
  // https://github.com/actions/setup-go
  'actions/setup-go': {
    datasource: GithubReleasesDatasource.id,
    depName: 'go',
    packageName: 'actions/go-versions',
    versioning: npmVersioning.id,
    extractVersion: actionsVersionsExtractVersion,
    withSchema: valSchema('go-version'),
  },
  // https://github.com/actions/setup-java
  'actions/setup-java': {
    datasource: JavaVersionDatasource.id,
    packageName: '', // determined from `distribution`/`java-package` inputs
    withSchema: SetupJavaWith,
  },
  // https://github.com/actions/setup-node
  'actions/setup-node': {
    datasource: GithubReleasesDatasource.id,
    depName: 'node',
    packageName: 'actions/node-versions',
    versioning: nodeVersioning.id,
    extractVersion: actionsVersionsExtractVersion,
    withSchema: valSchema('node-version'),
  },
  // https://github.com/actions/setup-python
  'actions/setup-python': {
    datasource: GithubReleasesDatasource.id,
    depName: 'python',
    packageName: 'actions/python-versions',
    versioning: npmVersioning.id,
    extractVersion: actionsVersionsExtractVersion,
    withSchema: valSchema('python-version'),
  },
  // https://github.com/aquaproj/aqua-installer
  'aquaproj/aqua-installer': {
    datasource: GithubReleasesDatasource.id,
    depName: 'aqua',
    packageName: 'aquaproj/aqua',
    withSchema: valSchema('aqua_version'),
  },
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
  // https://github.com/astral-sh/ruff-action
  'astral-sh/ruff-action': {
    datasource: GithubReleasesDatasource.id,
    depName: 'ruff',
    packageName: 'astral-sh/ruff',
  },
  // https://github.com/astral-sh/setup-uv
  'astral-sh/setup-uv': {
    datasource: GithubReleasesDatasource.id,
    versioning: npmVersioning.id,
    packageName: 'astral-sh/uv',
  },
  // https://github.com/aws-actions/amazon-ecs-render-task-definition
  'aws-actions/amazon-ecs-render-task-definition': {
    datasource: DockerDatasource.id,
    packageName: '', // determined from `image` input
    withSchema: EcsRenderTaskDefinitionWith,
  },
  'azure/setup-helm': {
    datasource: GithubReleasesDatasource.id,
    depName: 'helm',
    packageName: 'helm/helm',
  },
  // https://github.com/azure/setup-kubectl
  'azure/setup-kubectl': {
    datasource: GithubReleasesDatasource.id,
    depName: 'kubectl',
    packageName: 'kubernetes/kubernetes',
    withSchema: SetupKubectlWith,
  },
  // https://github.com/baptiste0928/cargo-install
  'baptiste0928/cargo-install': {
    datasource: CrateDatasource.id,
    packageName: '', // determined from the `crate` input
    withSchema: CargoInstallWith,
  },
  // https://github.com/biomejs/setup-biome
  'biomejs/setup-biome': {
    datasource: NpmDatasource.id,
    packageName: '@biomejs/biome',
  },
  // https://github.com/bufbuild/buf-setup-action
  'bufbuild/buf-setup-action': {
    datasource: GithubReleasesDatasource.id,
    depName: 'buf',
    packageName: 'bufbuild/buf',
  },
  // https://github.com/cargo-bins/cargo-binstall
  'cargo-bins/cargo-binstall': {
    datasource: GithubReleasesDatasource.id,
    packageName: 'cargo-bins/cargo-binstall',
    // the repo also publishes releases for its internal sub-crates (e.g.
    // `detect-targets-v0.1.91`, `binstalk-v0.28.81`) — only match the bare
    // main-tool release tag
    extractVersion: '^v(?<version>\\d+\\.\\d+\\.\\d+)$',
  },
  // https://github.com/cloudflare/wrangler-action
  'cloudflare/wrangler-action': {
    datasource: NpmDatasource.id,
    packageName: 'wrangler',
    withSchema: valSchema('wranglerVersion'),
  },
  // https://github.com/conda-incubator/setup-miniconda
  'conda-incubator/setup-miniconda': {
    datasource: GithubReleasesDatasource.id,
    packageName: '', // determined per dependency: miniforge-version, python-version
    withSchema: SetupMinicondaWith,
  },
  // https://github.com/crystal-lang/install-crystal
  'crystal-lang/install-crystal': {
    datasource: GithubReleasesDatasource.id,
    packageName: '', // determined per dependency: crystal, shards
    withSchema: InstallCrystalWith,
  },
  // https://github.com/cue-lang/setup-cue
  'cue-lang/setup-cue': {
    datasource: GithubReleasesDatasource.id,
    depName: 'cue',
    packageName: 'cue-lang/cue',
  },
  // https://github.com/cycjimmy/semantic-release-action
  'cycjimmy/semantic-release-action': {
    datasource: NpmDatasource.id,
    packageName: 'semantic-release',
    // the action's docs describe `semantic_version` as a version range, not
    // a pinned exact version
    versioning: npmVersioning.id,
    withSchema: valSchema('semantic_version'),
  },
  // https://github.com/dagger/dagger-for-github
  'dagger/dagger-for-github': {
    datasource: GithubReleasesDatasource.id,
    depName: 'dagger',
    packageName: 'dagger/dagger',
    // the repo also publishes per-SDK/component tags sharing the same
    // version (e.g. `sdk/typescript/v0.21.9`, `helm/chart/v0.21.9`) — only
    // match the bare release tag
    extractVersion: '^v(?<version>\\d+\\..*)$',
  },
  // https://github.com/dart-lang/setup-dart
  'dart-lang/setup-dart': {
    datasource: DartVersionDatasource.id,
    depName: 'dart',
    packageName: 'dart-lang/sdk',
    // `'stable'`/`'beta'`/`'dev'` are valid, documented channel names (and
    // `'stable'` is the action's own default), but not versions we can
    // pin/bump
    withSchema: valSchemaSkippingLiterals(
      'sdk',
      new Set(['stable', 'beta', 'dev']),
    ),
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
  // https://github.com/erlef/setup-beam
  'erlef/setup-beam': {
    datasource: GithubReleasesDatasource.id,
    packageName: '', // determined per dependency: OTP, Elixir, Gleam, rebar3
    withSchema: ErlefSetupBeamWith,
  },
  // https://github.com/expo/expo-github-action
  'expo/expo-github-action': {
    datasource: NpmDatasource.id,
    packageName: 'eas-cli',
    withSchema: valSchema('eas-version'),
  },
  // https://github.com/extractions/setup-just
  'extractions/setup-just': {
    datasource: GithubReleasesDatasource.id,
    depName: 'just',
    packageName: 'casey/just',
    withSchema: valSchema('just-version'),
  },
  // https://github.com/foundry-rs/foundry-toolchain
  'foundry-rs/foundry-toolchain': {
    datasource: GithubReleasesDatasource.id,
    depName: 'foundry',
    packageName: 'foundry-rs/foundry',
  },
  // https://github.com/GitTools/actions (there is no root-level Action, only
  // subpaths are usable; the sibling `GitTools/actions/gitreleasemanager/setup`
  // is a separate, unrelated Action)
  'GitTools/actions/gitversion/setup': {
    datasource: GithubReleasesDatasource.id,
    depName: 'gitversion',
    packageName: 'GitTools/GitVersion',
    withSchema: valSchema('versionSpec'),
  },
  'golangci/golangci-lint-action': {
    datasource: GithubReleasesDatasource.id,
    packageName: 'golangci/golangci-lint',
  },
  // https://github.com/goreleaser/goreleaser-action
  'goreleaser/goreleaser-action': {
    datasource: GithubReleasesDatasource.id,
    packageName: 'goreleaser/goreleaser',
    // the default value (`~> v2`) is itself a range, not a pinned version
    versioning: npmVersioning.id,
  },
  // https://github.com/graalvm/setup-graalvm
  'graalvm/setup-graalvm': {
    datasource: GithubReleasesDatasource.id,
    packageName: '', // determined per dependency: java-version, version
    withSchema: GraalvmSetupWith,
  },
  // https://github.com/gradle/actions (there is no root-level Action, only
  // subpaths such as `setup-gradle` are usable)
  'gradle/actions/setup-gradle': {
    datasource: GradleVersionDatasource.id,
    depName: 'gradle',
    packageName: 'gradle/gradle',
    versioning: gradleVersioning.id,
    withSchema: valSchema('gradle-version'),
  },
  // https://github.com/hashicorp/setup-packer
  'hashicorp/setup-packer': {
    datasource: GithubReleasesDatasource.id,
    depName: 'packer',
    packageName: 'hashicorp/packer',
  },
  // https://github.com/hashicorp/setup-terraform
  'hashicorp/setup-terraform': {
    datasource: GithubReleasesDatasource.id,
    depName: 'terraform',
    packageName: 'hashicorp/terraform',
    withSchema: valSchema('terraform_version'),
  },
  // https://github.com/helm/chart-releaser-action
  'helm/chart-releaser-action': {
    datasource: GithubReleasesDatasource.id,
    depName: 'chart-releaser',
    packageName: 'helm/chart-releaser',
  },
  // https://github.com/helm/chart-testing-action
  'helm/chart-testing-action': {
    datasource: GithubReleasesDatasource.id,
    depName: 'chart-testing',
    packageName: 'helm/chart-testing',
  },
  // https://github.com/helm/kind-action
  'helm/kind-action': {
    datasource: GithubReleasesDatasource.id,
    packageName: '', // determined per dependency: `version`, `node_image`, `kubectl_version`
    withSchema: KindActionWith,
  },
  // https://github.com/j178/prek-action
  'j178/prek-action': {
    datasource: GithubReleasesDatasource.id,
    depName: 'prek',
    packageName: 'j178/prek',
    // the value may be a semver range (e.g. `0.3.x`, `<=1.0.0`), not just a
    // pinned version
    versioning: npmVersioning.id,
    withSchema: valSchema('prek-version'),
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
  // https://github.com/jfrog/setup-jfrog-cli
  'jfrog/setup-jfrog-cli': {
    datasource: GithubReleasesDatasource.id,
    depName: 'jfrog-cli',
    packageName: 'jfrog/jfrog-cli',
  },
  // https://github.com/julia-actions/setup-julia
  'julia-actions/setup-julia': {
    datasource: GithubReleasesDatasource.id,
    depName: 'julia',
    packageName: 'JuliaLang/julia',
    // `'lts'`/`'pre'` are valid, documented values, but not ones we can
    // pin/bump
    withSchema: valSchemaSkippingLiterals('version', new Set(['lts', 'pre'])),
  },
  // https://github.com/jwlawson/actions-setup-cmake
  'jwlawson/actions-setup-cmake': {
    datasource: GithubReleasesDatasource.id,
    depName: 'cmake',
    packageName: 'Kitware/CMake',
    withSchema: valSchema('cmake-version'),
  },
  // https://github.com/moonrepo/setup-rust
  'moonrepo/setup-rust': {
    datasource: RustVersionDatasource.id,
    packageName: 'rust',
    withSchema: valSchema('channel'),
  },
  // https://github.com/moonrepo/setup-toolchain
  'moonrepo/setup-toolchain': {
    datasource: GithubReleasesDatasource.id,
    packageName: '', // determined per dependency: moon-version, proto-version
    withSchema: MoonrepoSetupToolchainWith,
  },
  // https://github.com/mozilla-actions/sccache-action
  'mozilla-actions/sccache-action': {
    datasource: GithubReleasesDatasource.id,
    depName: 'sccache',
    packageName: 'mozilla/sccache',
  },
  // https://github.com/opentofu/setup-opentofu
  'opentofu/setup-opentofu': {
    datasource: GithubReleasesDatasource.id,
    depName: 'opentofu',
    packageName: 'opentofu/opentofu',
    withSchema: valSchema('tofu_version'),
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
  // https://github.com/peaceiris/actions-hugo
  'peaceiris/actions-hugo': {
    datasource: GithubReleasesDatasource.id,
    depName: 'hugo',
    packageName: 'gohugoio/hugo',
    withSchema: valSchema('hugo-version'),
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
  // https://github.com/pulumi/actions
  'pulumi/actions': {
    datasource: GithubReleasesDatasource.id,
    depName: 'pulumi',
    packageName: 'pulumi/pulumi',
    withSchema: valSchema('pulumi-version'),
  },
  // https://github.com/PyO3/maturin-action
  'PyO3/maturin-action': {
    datasource: PypiDatasource.id,
    packageName: 'maturin',
    withSchema: valSchema('maturin-version'),
  },
  // https://github.com/pypa/hatch/tree/install
  'pypa/hatch': {
    datasource: GithubReleasesDatasource.id,
    packageName: 'pypa/hatch',
    // Strip hatch- prefix from release tags
    extractVersion: '^hatch-(?<version>.+)$',
  },
  // https://github.com/raven-actions/actionlint
  'raven-actions/actionlint': {
    datasource: GithubReleasesDatasource.id,
    depName: 'actionlint',
    packageName: 'rhysd/actionlint',
  },
  // https://github.com/renovatebot/github-action
  'renovatebot/github-action': {
    datasource: DockerDatasource.id,
    packageName: '', // determined from `renovate-image` input, if set
    withSchema: RenovateGithubActionWith,
  },
  // https://github.com/reviewdog/action-setup
  'reviewdog/action-setup': {
    datasource: GithubReleasesDatasource.id,
    depName: 'reviewdog',
    packageName: 'reviewdog/reviewdog',
    withSchema: valSchema('reviewdog_version'),
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
  // https://github.com/snok/install-poetry
  'snok/install-poetry': {
    datasource: PypiDatasource.id,
    packageName: 'poetry',
  },
  // https://github.com/stCarolas/setup-maven
  'stCarolas/setup-maven': {
    datasource: GithubReleasesDatasource.id,
    depName: 'maven',
    packageName: 'apache/maven',
    // apache/maven tags its releases as `maven-X.Y.Z`
    extractVersion: '^maven-(?<version>.+)$',
    // the input also documents range/glob specs (e.g. `10.x`, `>=10.15.0`),
    // not just pinned versions
    versioning: npmVersioning.id,
    withSchema: valSchema('maven-version'),
  },
  // https://github.com/subosito/flutter-action
  'subosito/flutter-action': {
    datasource: GithubReleasesDatasource.id,
    depName: 'flutter',
    packageName: 'flutter/flutter',
    withSchema: valSchema('flutter-version'),
  },
  // https://github.com/supabase/setup-cli
  'supabase/setup-cli': {
    datasource: NpmDatasource.id,
    packageName: 'supabase',
    withSchema: valSchemaSkippingLiterals(
      'version',
      new Set(['latest', 'beta']),
    ),
  },
  // https://github.com/superfly/flyctl-actions (there is no root-level
  // Action for this purpose — the repo root has an unrelated action.yml, and
  // the real usable Action lives at the `setup-flyctl` subpath)
  'superfly/flyctl-actions/setup-flyctl': {
    datasource: GithubReleasesDatasource.id,
    depName: 'flyctl',
    packageName: 'superfly/flyctl',
  },
  // https://github.com/swift-actions/setup-swift
  'swift-actions/setup-swift': {
    datasource: GithubReleasesDatasource.id,
    depName: 'swift',
    packageName: 'swiftlang/swift',
    // swiftlang/swift tags releases like `swift-6.3.3-RELEASE`
    extractVersion: '^swift-(?<version>.+)-RELEASE$',
    withSchema: valSchema('swift-version'),
  },
  // https://github.com/terraform-linters/setup-tflint
  'terraform-linters/setup-tflint': {
    datasource: GithubReleasesDatasource.id,
    depName: 'tflint',
    packageName: 'terraform-linters/tflint',
    withSchema: TflintWith,
  },
  'UpCloudLtd/upcloud-cli-action': {
    datasource: GithubReleasesDatasource.id,
    packageName: 'UpCloudLtd/upcloud-cli',
  },
  // https://github.com/WillAbides/setup-go-faster
  'WillAbides/setup-go-faster': {
    datasource: GithubReleasesDatasource.id,
    depName: 'go',
    packageName: 'actions/go-versions',
    versioning: npmVersioning.id,
    extractVersion: actionsVersionsExtractVersion,
    withSchema: valSchema('go-version'),
  },
  'zizmorcore/zizmor-action': {
    datasource: DockerDatasource.id,
    packageName: 'ghcr.io/zizmorcore/zizmor',
  },
};
