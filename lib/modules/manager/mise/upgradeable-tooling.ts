import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { HexpmBobDatasource } from '../../datasource/hexpm-bob';
import { JavaVersionDatasource } from '../../datasource/java-version';
import { NodeVersionDatasource } from '../../datasource/node-version';
import { RubyVersionDatasource } from '../../datasource/ruby-version';
import * as regexVersioning from '../../versioning/regex';
import * as semverVersioning from '../../versioning/semver';
import type { ToolingConfig } from '../asdf/upgradeable-tooling';
import { upgradeableTooling } from '../asdf/upgradeable-tooling';

export interface ToolingDefinition {
  config: ToolingConfig;
  misePluginUrl?: string;
}

export const asdfTooling = upgradeableTooling;

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
      const versionMatch = /^(\d\S+)/.exec(version)?.[1];
      if (versionMatch) {
        return {
          datasource: JavaVersionDatasource.id,
          packageName: 'java-jdk',
          currentValue: versionMatch,
        };
      }
      const openJdkMatches = /^openjdk-(?<version>\d\S+)/.exec(version)?.groups;
      if (openJdkMatches) {
        return {
          datasource: JavaVersionDatasource.id,
          packageName: 'java-jdk',
          currentValue: openJdkMatches.version,
        };
      }
      const adoptOpenJdkMatches = /^adoptopenjdk-(?<version>\d\S+)/.exec(
        version,
      )?.groups;
      if (adoptOpenJdkMatches) {
        return {
          datasource: JavaVersionDatasource.id,
          packageName: 'java-jdk',
          currentValue: adoptOpenJdkMatches.version,
        };
      }
      const temurinJdkMatches = /^temurin-(?<version>\d\S+)/.exec(
        version,
      )?.groups;
      if (temurinJdkMatches) {
        return {
          datasource: JavaVersionDatasource.id,
          packageName: 'java-jdk',
          currentValue: temurinJdkMatches.version,
        };
      }
      const correttoJdkMatches = /^corretto-(?<version>\d\S+)/.exec(
        version,
      )?.groups;
      if (correttoJdkMatches) {
        return {
          datasource: JavaVersionDatasource.id,
          packageName: 'java-jdk',
          currentValue: correttoJdkMatches.version,
        };
      }
      const zuluJdkMatches = /^zulu-(?<version>\d\S+)/.exec(version)?.groups;
      if (zuluJdkMatches) {
        return {
          datasource: JavaVersionDatasource.id,
          packageName: 'java-jdk',
          currentValue: zuluJdkMatches.version,
        };
      }
      const oracleGraalvmJdkMatches = /^oracle-graalvm-(?<version>\d\S+)/.exec(
        version,
      )?.groups;
      if (oracleGraalvmJdkMatches) {
        return {
          datasource: JavaVersionDatasource.id,
          packageName: 'java-jdk',
          currentValue: oracleGraalvmJdkMatches.version,
        };
      }

      return undefined;
    },
  },
  node: {
    misePluginUrl: 'https://mise.jdx.dev/lang/node.html',
    config: {
      packageName: 'nodejs',
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
  consul: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'hashicorp/consul',
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
  jq: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'jqlang/jq',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^jq-v(?<version>\\S+)',
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
  localstack: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'localstack/localstack',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^v(?<version>\\S+)',
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
  protoc: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'protocolbuffers/protobuf',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^v(?<version>\\S+)',
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
  stripe: {
    misePluginUrl: 'https://mise.jdx.dev/registry.html#tools',
    config: {
      packageName: 'stripe/stripe-cli',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^v(?<version>\\S+)',
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
};

export const miseTooling: Record<string, ToolingDefinition> = {
  ...miseCoreTooling,
  ...miseRegistryTooling,
};
