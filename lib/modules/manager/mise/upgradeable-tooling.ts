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

export const miseTooling: Record<string, ToolingDefinition> = {
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
      const versionMatch = version.match(/^(\d\S+)/)?.[1];
      if (versionMatch) {
        return {
          datasource: JavaVersionDatasource.id,
          packageName: 'java-jdk',
          currentValue: versionMatch,
        };
      }
      const openJdkMatches = version.match(
        /^openjdk-(?<version>\d\S+)/,
      )?.groups;
      if (openJdkMatches) {
        return {
          datasource: JavaVersionDatasource.id,
          packageName: 'java-jdk',
          currentValue: openJdkMatches.version,
        };
      }
      const adoptOpenJdkMatches = version.match(
        /^adoptopenjdk-(?<version>\d\S+)/,
      )?.groups;
      if (adoptOpenJdkMatches) {
        return {
          datasource: JavaVersionDatasource.id,
          packageName: 'java-jdk',
          currentValue: adoptOpenJdkMatches.version,
        };
      }
      const temurinJdkMatches = version.match(
        /^temurin-(?<version>\d\S+)/,
      )?.groups;
      if (temurinJdkMatches) {
        return {
          datasource: JavaVersionDatasource.id,
          packageName: 'java-jdk',
          currentValue: temurinJdkMatches.version,
        };
      }
      const correttoJdkMatches = version.match(
        /^corretto-(?<version>\d\S+)/,
      )?.groups;
      if (correttoJdkMatches) {
        return {
          datasource: JavaVersionDatasource.id,
          packageName: 'java-jdk',
          currentValue: correttoJdkMatches.version,
        };
      }
      const zuluJdkMatches = version.match(/^zulu-(?<version>\d\S+)/)?.groups;
      if (zuluJdkMatches) {
        return {
          datasource: JavaVersionDatasource.id,
          packageName: 'java-jdk',
          currentValue: zuluJdkMatches.version,
        };
      }
      const oracleGraalvmJdkMatches = version.match(
        /^oracle-graalvm-(?<version>\d\S+)/,
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
