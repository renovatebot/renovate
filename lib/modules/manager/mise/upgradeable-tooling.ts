import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { JavaVersionDatasource } from '../../datasource/java-version';
import { NodeVersionDatasource } from '../../datasource/node-version';
import { RubyVersionDatasource } from '../../datasource/ruby-version';
import * as regexVersioning from '../../versioning/regex';
import * as semverVersioning from '../../versioning/semver';
import { upgradeableTooling } from '../asdf/upgradeable-tooling';
import type { PackageDependency } from '../types';

export type StaticTooling = Partial<PackageDependency> &
  Required<Pick<PackageDependency, 'datasource'>>;

export type DynamicTooling = (version: string) => StaticTooling | undefined;

export type ToolingConfig = StaticTooling | DynamicTooling;
export interface ToolingDefinition {
  config: ToolingConfig;
  misePluginUrl?: string;
  asdfPluginUrl?: string;
}

export const asdfTooling = upgradeableTooling;

export const miseCorePlugins = [
  'bun',
  'deno',
  'erlang',
  'go',
  'java',
  'node',
  'python',
  'ruby',
];

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
      const adoptOpenJreMatches = version.match(
        /^adoptopenjdk-jre-(?<version>\d\S+)/,
      )?.groups;
      if (adoptOpenJreMatches) {
        return {
          datasource: JavaVersionDatasource.id,
          packageName: 'java-jre',
          currentValue: adoptOpenJreMatches.version,
        };
      }
      const semeruJdkMatches = version.match(
        /^semeru-openj9-(?<version>\d\S+)_openj9-(?<openj9>\d\S+)/,
      )?.groups;
      if (semeruJdkMatches) {
        return {
          datasource: JavaVersionDatasource.id,
          packageName: 'java-jdk',
          currentValue: semeruJdkMatches.version,
        };
      }
      const semeruJreMatches = version.match(
        /^semeru-jre-openj9-(?<version>\d\S+)_openj9-\d\S+/,
      )?.groups;
      if (semeruJreMatches) {
        return {
          datasource: JavaVersionDatasource.id,
          packageName: 'java-jre',
          currentValue: semeruJreMatches.version,
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
      const temurinJreMatches = version.match(
        /^temurin-jre-(?<version>\d\S+)/,
      )?.groups;
      if (temurinJreMatches) {
        return {
          datasource: JavaVersionDatasource.id,
          packageName: 'java-jre',
          currentValue: temurinJreMatches.version,
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
};
