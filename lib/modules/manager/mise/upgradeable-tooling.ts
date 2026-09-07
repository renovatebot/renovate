import miseRegistry from '../../../data/mise-registry.json' with { type: 'json' };
import { coerceObject } from '../../../util/object.ts';
import { regEx } from '../../../util/regex.ts';
import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { JavaVersionDatasource } from '../../datasource/java-version/index.ts';
import { NodeVersionDatasource } from '../../datasource/node-version/index.ts';
import { NpmDatasource } from '../../datasource/npm/index.ts';
import * as semverPartialVersioning from '../../versioning/semver-partial/index.ts';
import type { JavaDistribution } from '../asdf/types.ts';
import { upgradeableTooling } from '../asdf/upgradeable-tooling.ts';
import { matchJavaDistribution } from '../asdf/utils.ts';
import { MiseRegistryJson } from './schema.ts';
import type { MiseRegistryData, ToolingDefinition } from './types.ts';

export const asdfTooling = upgradeableTooling;

/**
 * Declare a mise short name that resolves exactly like an asdf plugin, reusing
 * the asdf config so both managers stay in sync. Never copy an asdf config
 * into the tables below: `upgradeable-tooling.spec.ts` rejects duplicates.
 */
function fromAsdfTooling(
  asdfName: string,
  misePluginUrl = 'https://mise.jdx.dev/registry.html#tools',
): ToolingDefinition {
  return { misePluginUrl, config: asdfTooling[asdfName].config };
}

function shortJavaVersioning(version: string): { versioning?: string } {
  if (regEx(/^\d+(?:\.\d+)?$/).test(version)) {
    return { versioning: semverPartialVersioning.id };
  }
  return {};
}

/** mise ships a single jdk per distribution; an empty prefix means openjdk. */
const miseJavaDistributions: readonly JavaDistribution[] = [
  { prefix: '', packageName: 'java-jdk' },
  { prefix: 'openjdk-', packageName: 'java-jdk' },
  { prefix: 'adoptopenjdk-', packageName: 'java-jdk' },
  { prefix: 'temurin-', packageName: 'java-jdk' },
  { prefix: 'corretto-', packageName: 'java-jdk' },
  { prefix: 'zulu-', packageName: 'java-jdk' },
  { prefix: 'oracle-graalvm-', packageName: 'java-jdk' },
];

const miseCoreTooling: Record<string, ToolingDefinition> = {
  bun: fromAsdfTooling('bun', 'https://mise.jdx.dev/lang/bun.html'),
  deno: fromAsdfTooling('deno', 'https://mise.jdx.dev/lang/deno.html'),
  elixir: fromAsdfTooling('elixir', 'https://mise.jdx.dev/lang/elixir.html'),
  erlang: fromAsdfTooling('erlang', 'https://mise.jdx.dev/lang/erlang.html'),
  go: fromAsdfTooling('golang', 'https://mise.jdx.dev/lang/go.html'),
  java: {
    misePluginUrl: 'https://mise.jdx.dev/lang/java.html',
    config: (version) => {
      const match = matchJavaDistribution(version, miseJavaDistributions);
      if (!match) {
        return undefined;
      }
      return {
        datasource: JavaVersionDatasource.id,
        ...match,
        ...shortJavaVersioning(match.currentValue),
      };
    },
  },
  node: {
    misePluginUrl: 'https://mise.jdx.dev/lang/node.html',
    config: {
      packageName: 'node',
      datasource: NodeVersionDatasource.id,
    },
  },
  python: fromAsdfTooling('python', 'https://mise.jdx.dev/lang/python.html'),
  ruby: fromAsdfTooling('ruby', 'https://mise.jdx.dev/lang/ruby.html'),
  rust: fromAsdfTooling('rust', 'https://mise.jdx.dev/lang/rust.html'),
  swift: {
    misePluginUrl: 'https://mise.jdx.dev/lang/swift.html',
    config: {
      packageName: 'swift-lang/swift',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^swift-(?<version>\\S+)',
    },
  },
  zig: fromAsdfTooling('zig', 'https://mise.jdx.dev/lang/zig.html'),
};

const miseRegistryTooling: Record<string, ToolingDefinition> = {
  actionlint: fromAsdfTooling('actionlint'),
  astro: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'astronomer/astro-cli',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  'aws-cli': {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      datasource: GithubTagsDatasource.id,
      packageName: 'aws/aws-cli',
    },
  },
  'aws-vault': {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: '99designs/aws-vault',
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  buf: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'bufbuild/buf',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  caddy: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'caddyserver/caddy',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  ccache: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'ccache/ccache',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  'clang-format': {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'llvm/llvm-project',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^llvmorg-(?<version>\\S+)',
    },
  },
  committed: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'crate-ci/committed',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  conan: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'conan-io/conan',
      datasource: GithubReleasesDatasource.id,
    },
  },
  consul: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'hashicorp/consul',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  gh: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'cli/cli',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  'dotenv-linter': {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'dotenv-linter/dotenv-linter',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  hivemind: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'DarthSim/hivemind',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  hk: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'jdx/hk',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  jq: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'jqlang/jq',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^jq-(?<version>\\S+)',
    },
  },
  kafka: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: (version) => {
      const apacheMatches = regEx(/^apache-(?<version>\d\S+)/).exec(
        version,
      )?.groups;
      if (apacheMatches) {
        return {
          datasource: GithubTagsDatasource.id,
          packageName: 'apache/kafka',
          currentValue: apacheMatches.version,
        };
      }

      return undefined;
    },
  },
  lefthook: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'evilmartians/lefthook',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  localstack: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'localstack/localstack',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  lychee: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'lycheeverse/lychee',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^lychee-v(?<version>\\S+)',
    },
  },
  npm: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'npm',
      datasource: NpmDatasource.id,
    },
  },
  opentofu: fromAsdfTooling('opentofu'),
  openfga: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'openfga/openfga',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  packer: fromAsdfTooling('packer'),
  pipx: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'pypa/pipx',
      datasource: GithubReleasesDatasource.id,
    },
  },
  pkl: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'apple/pkl',
      datasource: GithubReleasesDatasource.id,
    },
  },
  prettier: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'prettier/prettier',
      datasource: GithubReleasesDatasource.id,
    },
  },
  protoc: fromAsdfTooling('protoc'),
  pnpm: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'pnpm',
      datasource: NpmDatasource.id,
    },
  },
  redis: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'redis/redis',
      datasource: GithubReleasesDatasource.id,
    },
  },
  ruff: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'astral-sh/ruff',
      datasource: GithubReleasesDatasource.id,
    },
  },
  rumdl: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'rvben/rumdl',
      datasource: GithubReleasesDatasource.id,
    },
  },
  shellcheck: fromAsdfTooling('shellcheck'),
  skeema: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'skeema/skeema',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  sops: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'getsops/sops',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  sqlite: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'sqlite/sqlite',
      datasource: GithubTagsDatasource.id,
      extractVersion: '^version-(?<version>\\S+)',
    },
  },
  stripe: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'stripe/stripe-cli',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  swiftformat: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'nicklockwood/SwiftFormat',
      datasource: GithubReleasesDatasource.id,
    },
  },
  swiftlint: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'realm/SwiftLint',
      datasource: GithubReleasesDatasource.id,
    },
  },
  taplo: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'tamasfe/taplo',
      datasource: GithubReleasesDatasource.id,
    },
  },
  tart: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'cirruslabs/tart',
      datasource: GithubReleasesDatasource.id,
    },
  },
  terragrunt: fromAsdfTooling('terragrunt'),
  tilt: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'tilt-dev/tilt',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  tusd: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'tus/tusd',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  usage: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'jdx/usage',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  yarn: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: '@yarnpkg/cli',
      datasource: NpmDatasource.id,
    },
  },
};

export const miseTooling: Record<string, ToolingDefinition> = {
  ...miseCoreTooling,
  ...miseRegistryTooling,
};

export const parsedMiseRegistry: MiseRegistryData = Object.freeze(
  MiseRegistryJson.parse(miseRegistry),
);

export function getOrderedMiseRegistryBackends(
  toolName: string,
): Record<string, string> {
  return coerceObject(parsedMiseRegistry.tools[toolName]);
}
