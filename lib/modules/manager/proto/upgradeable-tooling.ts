import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { NodeVersionDatasource } from '../../datasource/node-version/index.ts';
import { NpmDatasource } from '../../datasource/npm/index.ts';
import { RubyVersionDatasource } from '../../datasource/ruby-version/index.ts';
import * as semverVersioning from '../../versioning/semver/index.ts';
import type { StaticTooling } from '../asdf/upgradeable-tooling.ts';

export interface ToolingDefinition {
  config: StaticTooling;
}

/**
 * Maps proto built-in tool names to Renovate datasource configurations.
 * @see https://moonrepo.dev/docs/proto/config
 */
export const protoTooling: Record<string, ToolingDefinition> = {
  bun: {
    config: {
      packageName: 'oven-sh/bun',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^bun-v(?<version>\\S+)',
    },
  },
  deno: {
    config: {
      packageName: 'denoland/deno',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  go: {
    config: {
      packageName: 'golang/go',
      datasource: GithubTagsDatasource.id,
      extractVersion: '^go(?<version>\\S+)',
    },
  },
  moon: {
    config: {
      packageName: 'moonrepo/moon',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  node: {
    config: {
      packageName: 'node',
      datasource: NodeVersionDatasource.id,
    },
  },
  npm: {
    config: {
      packageName: 'npm',
      datasource: NpmDatasource.id,
    },
  },
  pnpm: {
    config: {
      packageName: 'pnpm',
      datasource: NpmDatasource.id,
    },
  },
  yarn: {
    config: {
      packageName: '@yarnpkg/cli',
      datasource: NpmDatasource.id,
    },
  },
  python: {
    config: {
      packageName: 'python/cpython',
      datasource: GithubTagsDatasource.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  ruby: {
    config: {
      packageName: 'ruby-version',
      datasource: RubyVersionDatasource.id,
      versioning: semverVersioning.id,
    },
  },
  rust: {
    config: {
      packageName: 'rust-lang/rust',
      datasource: GithubTagsDatasource.id,
    },
  },
  proto: {
    config: {
      packageName: 'moonrepo/proto',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  gh: {
    config: {
      packageName: 'cli/cli',
      datasource: GithubReleasesDatasource.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  poetry: {
    config: {
      packageName: 'python-poetry/poetry',
      datasource: GithubReleasesDatasource.id,
    },
  },
  uv: {
    config: {
      packageName: 'astral-sh/uv',
      datasource: GithubReleasesDatasource.id,
    },
  },
};
