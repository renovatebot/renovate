import { z } from 'zod/v4';
import { DockerDatasource } from '../../../datasource/docker/index.ts';
import { GithubReleasesDatasource } from '../../../datasource/github-releases/index.ts';
import { JavaVersionDatasource } from '../../../datasource/java-version/index.ts';
import { NodeVersionDatasource } from '../../../datasource/node-version/index.ts';
import { NpmDatasource } from '../../../datasource/npm/index.ts';
import type { PackageDependency } from '../../types.ts';
import {
  type ActionSchema,
  DATASOURCE_DETERMINED_DYNAMICALLY,
  type KnownActionConfig,
} from '../types.ts';
import { parseJavaVersion } from './java-version-dynamic.ts';
import { parseImageValue, parseValue } from './utils.ts';

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
        ...parseJavaVersion(javaVersion),
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
 * Entries whose emitted dependencies span more than one datasource, so no
 * single-datasource file (or its structural "same datasource" test) applies.
 */
export const multipleActions: Record<string, KnownActionConfig> = {
  // https://github.com/graalvm/setup-graalvm
  'graalvm/setup-graalvm': {
    datasource: DATASOURCE_DETERMINED_DYNAMICALLY,
    packageName: '', // determined per dependency: java-version, version
    withSchema: GraalvmSetupWith,
  },
  // https://github.com/helm/kind-action
  'helm/kind-action': {
    datasource: GithubReleasesDatasource.id,
    packageName: '', // determined per dependency: `version`, `node_image`, `kubectl_version`
    withSchema: KindActionWith,
  },
  'pnpm/setup': {
    datasource: NpmDatasource.id,
    packageName: 'pnpm',
    withSchema: PnpmSetupWith,
  },
};
