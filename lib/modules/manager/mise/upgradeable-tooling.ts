import miseRegistry from '../../../data/mise-registry.json' with { type: 'json' };
import { regEx } from '../../../util/regex.ts';
import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { HexpmBobDatasource } from '../../datasource/hexpm-bob/index.ts';
import { JavaVersionDatasource } from '../../datasource/java-version/index.ts';
import { MavenDatasource } from '../../datasource/maven/index.ts';
import { NodeVersionDatasource } from '../../datasource/node-version/index.ts';
import { NpmDatasource } from '../../datasource/npm/index.ts';
import { RubyVersionDatasource } from '../../datasource/ruby-version/index.ts';
import * as regexVersioning from '../../versioning/regex/index.ts';
import * as semverVersioning from '../../versioning/semver/index.ts';
import * as semverPartialVersioning from '../../versioning/semver-partial/index.ts';
import type { ToolingConfig } from '../asdf/upgradeable-tooling.ts';
import { upgradeableTooling } from '../asdf/upgradeable-tooling.ts';
import { MiseRegistryJson } from './schema.ts';

export interface ToolingDefinition {
  config: ToolingConfig;
  misePluginUrl?: string;
}

export const asdfTooling = upgradeableTooling;

function shortJavaVersioning(version: string): { versioning?: string } {
  if (regEx(/^\d+(\.\d+)?$/).test(version)) {
    return { versioning: semverPartialVersioning.id };
  }
  return {};
}

const miseCoreTooling: Record<string, ToolingDefinition> = {
  bun: {
    misePluginUrl: 'https://mise.jdx.dev/lang/bun.html',
    config: {
      packageName: 'oven-sh/bun',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^bun-v(?<version>\\S+)',
    },
  },
  deno: {
    misePluginUrl: 'https://mise.jdx.dev/lang/deno.html',
    config: {
      packageName: 'denoland/deno',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  elixir: {
    misePluginUrl: 'https://mise.jdx.dev/lang/elixir.html',
    config: {
      datasource: HexpmBobDatasource.id,
    },
  },
  erlang: {
    misePluginUrl: 'https://mise.jdx.dev/lang/erlang.html',
    config: {
      packageName: 'erlang/otp',
      datasource: GithubTagsDatasource.id,
      extractVersion: '^OTP-(?<version>\\S+)',
      versioning: `${regexVersioning.id}:^(?<major>\\d+?)\\.(?<minor>\\d+?)(\\.(?<patch>\\d+))?$`,
    },
  },
  go: {
    misePluginUrl: 'https://mise.jdx.dev/lang/go.html',
    config: {
      packageName: 'golang/go',
      datasource: GithubTagsDatasource.id,
      extractVersion: '^go(?<version>\\S+)',
    },
  },
  java: {
    misePluginUrl: 'https://mise.jdx.dev/lang/java.html',
    config: (version) => {
      // no prefix is shorthand for openjdk
      const versionMatch = regEx(/^(\d\S+)/).exec(version)?.[1];
      if (versionMatch) {
        return {
          datasource: JavaVersionDatasource.id,
          packageName: 'java-jdk',
          currentValue: versionMatch,
          ...shortJavaVersioning(versionMatch),
        };
      }
      const openJdkMatches = regEx(/^openjdk-(?<version>\d\S+)/).exec(
        version,
      )?.groups;
      if (openJdkMatches) {
        return {
          datasource: JavaVersionDatasource.id,
          packageName: 'java-jdk',
          currentValue: openJdkMatches.version,
          ...shortJavaVersioning(openJdkMatches.version),
        };
      }
      const adoptOpenJdkMatches = regEx(/^adoptopenjdk-(?<version>\d\S+)/).exec(
        version,
      )?.groups;
      if (adoptOpenJdkMatches) {
        return {
          datasource: JavaVersionDatasource.id,
          packageName: 'java-jdk',
          currentValue: adoptOpenJdkMatches.version,
          ...shortJavaVersioning(adoptOpenJdkMatches.version),
        };
      }
      const temurinJdkMatches = regEx(/^temurin-(?<version>\d\S+)/).exec(
        version,
      )?.groups;
      if (temurinJdkMatches) {
        return {
          datasource: JavaVersionDatasource.id,
          packageName: 'java-jdk',
          currentValue: temurinJdkMatches.version,
          ...shortJavaVersioning(temurinJdkMatches.version),
        };
      }
      const correttoJdkMatches = regEx(/^corretto-(?<version>\d\S+)/).exec(
        version,
      )?.groups;
      if (correttoJdkMatches) {
        return {
          datasource: JavaVersionDatasource.id,
          packageName: 'java-jdk',
          currentValue: correttoJdkMatches.version,
          ...shortJavaVersioning(correttoJdkMatches.version),
        };
      }
      const zuluJdkMatches = regEx(/^zulu-(?<version>\d\S+)/).exec(
        version,
      )?.groups;
      if (zuluJdkMatches) {
        return {
          datasource: JavaVersionDatasource.id,
          packageName: 'java-jdk',
          currentValue: zuluJdkMatches.version,
          ...shortJavaVersioning(zuluJdkMatches.version),
        };
      }
      const oracleGraalvmJdkMatches = regEx(
        /^oracle-graalvm-(?<version>\d\S+)/,
      ).exec(version)?.groups;
      if (oracleGraalvmJdkMatches) {
        return {
          datasource: JavaVersionDatasource.id,
          packageName: 'java-jdk',
          currentValue: oracleGraalvmJdkMatches.version,
          ...shortJavaVersioning(oracleGraalvmJdkMatches.version),
        };
      }

      return undefined;
    },
  },
  node: {
    misePluginUrl: 'https://mise.jdx.dev/lang/node.html',
    config: {
      packageName: 'node',
      datasource: NodeVersionDatasource.id,
    },
  },
  python: {
    misePluginUrl: 'https://mise.jdx.dev/lang/python.html',
    config: {
      packageName: 'python/cpython',
      datasource: GithubTagsDatasource.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  ruby: {
    misePluginUrl: 'https://mise.jdx.dev/lang/ruby.html',
    config: {
      packageName: 'ruby-version',
      datasource: RubyVersionDatasource.id,
      versioning: semverVersioning.id,
    },
  },
  rust: {
    misePluginUrl: 'https://mise.jdx.dev/lang/rust.html',
    config: {
      packageName: 'rust-lang/rust',
      datasource: GithubTagsDatasource.id,
    },
  },
  swift: {
    misePluginUrl: 'https://mise.jdx.dev/lang/swift.html',
    config: {
      packageName: 'swift-lang/swift',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^swift-(?<version>\\S+)',
    },
  },
  zig: {
    misePluginUrl: 'https://mise.jdx.dev/lang/zig.html',
    config: {
      packageName: 'ziglang/zig',
      datasource: GithubTagsDatasource.id,
    },
  },
};

const miseRegistryTooling: Record<string, ToolingDefinition> = {
  actionlint: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'rhysd/actionlint',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
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
      const apacheMatches = /^apache-(?<version>\d\S+)/.exec(version)?.groups;
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
  neo4j: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'org.neo4j:neo4j',
      datasource: MavenDatasource.id,
    },
  },
  npm: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'npm',
      datasource: NpmDatasource.id,
    },
  },
  opentofu: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'opentofu/opentofu',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  openfga: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'openfga/openfga',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  packer: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'hashicorp/packer',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
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
  protoc: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'protocolbuffers/protobuf',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
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
  shellcheck: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'koalaman/shellcheck',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
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
  terragrunt: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'gruntwork-io/terragrunt',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
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

export const parsedMiseRegistry: Record<
  string,
  Record<string, string>
> = Object.freeze(MiseRegistryJson.parse(miseRegistry));

export function getOrderedMiseRegistryBackends(
  toolName: string,
): Record<string, string> {
  return parsedMiseRegistry[toolName] ?? [];
}
