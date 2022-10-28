import { AdoptiumJavaDatasource } from '../../datasource/adoptium-java';
import { DockerDatasource } from '../../datasource/docker';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { NodeDatasource } from '../../datasource/node';
import * as hermitVersioning from '../../versioning/hermit';
import * as nodeVersioning from '../../versioning/node';
import * as regexVersioning from '../../versioning/regex';
import * as semverVersioning from '../../versioning/semver';
import type { PackageDependency } from '../types';

type StaticTooling = Pick<
  PackageDependency,
  'depName' | 'datasource' | 'packageName' | 'versioning' | 'extractVersion'
>;

type DynamicTooling = (version: string) => StaticTooling | undefined;

export const upgradeableTooling: Record<
  string,
  StaticTooling | DynamicTooling
> = {
  awscli: {
    datasource: GithubTagsDatasource.id,
    packageName: 'aws/aws-cli',
    versioning: semverVersioning.id,
  },
  bun: {
    datasource: GithubReleasesDatasource.id,
    packageName: 'oven-sh/bun',
    versioning: semverVersioning.id,
    extractVersion: '^bun-v(?<version>\\S+)',
  },
  'cargo-make': {
    datasource: GithubReleasesDatasource.id,
    packageName: 'sagiegurari/cargo-make',
    versioning: semverVersioning.id,
  },
  clojure: {
    datasource: GithubTagsDatasource.id,
    packageName: 'clojure/brew-install',
    versioning: `${regexVersioning.id}:^(?<major>\\d+?)\\.(?<minor>\\d+?)\\.(?<patch>\\d+)\\.(?<build>\\d+)$`,
  },
  crystal: {
    datasource: GithubTagsDatasource.id,
    packageName: 'crystal-lang/crystal',
    versioning: semverVersioning.id,
  },
  deno: {
    datasource: GithubReleasesDatasource.id,
    packageName: 'denoland/deno',
    versioning: semverVersioning.id,
    extractVersion: '^v(?<version>\\S+)',
  },
  direnv: {
    datasource: GithubReleasesDatasource.id,
    packageName: 'direnv/direnv',
    versioning: semverVersioning.id,
    extractVersion: '^v(?<version>\\S+)',
  },
  dprint: {
    datasource: GithubReleasesDatasource.id,
    packageName: 'dprint/dprint',
    versioning: semverVersioning.id,
  },
  elixir: {
    datasource: GithubTagsDatasource.id,
    packageName: 'elixir-lang/elixir',
    versioning: semverVersioning.id,
    extractVersion: '^v(?<version>\\S+)',
  },
  elm: {
    datasource: GithubReleasesDatasource.id,
    packageName: 'elm/compiler',
    versioning: semverVersioning.id,
  },
  erlang: {
    datasource: GithubTagsDatasource.id,
    packageName: 'erlang/otp',
    extractVersion: '^OTP-(?<version>\\S+)',
    versioning: `${regexVersioning.id}:^(?<major>\\d+?)\\.(?<minor>\\d+?)(\\.(?<patch>\\d+))?$`,
  },
  gauche: {
    datasource: DockerDatasource.id,
    packageName: 'practicalscheme/gauche',
    versioning: semverVersioning.id,
  },
  golang: {
    datasource: GithubTagsDatasource.id,
    packageName: 'golang/go',
    versioning: semverVersioning.id,
    extractVersion: '^go(?<version>\\S+)',
  },
  haskell: {
    datasource: GithubTagsDatasource.id,
    packageName: 'ghc/ghc',
    versioning: semverVersioning.id,
    extractVersion: '^ghc-(?<version>\\S+?)-release',
  },
  helm: {
    datasource: GithubTagsDatasource.id,
    packageName: 'helm/helm',
    versioning: semverVersioning.id,
    extractVersion: '^v(?<version>\\S+)',
  },
  helmfile: {
    datasource: GithubReleasesDatasource.id,
    packageName: 'helmfile/helmfile',
    versioning: semverVersioning.id,
    extractVersion: '^v(?<version>\\S+)',
  },
  hugo: {
    datasource: GithubReleasesDatasource.id,
    packageName: 'gohugoio/hugo',
    versioning: semverVersioning.id,
    extractVersion: '^v(?<version>\\S+)',
  },
  idris: {
    datasource: GithubTagsDatasource.id,
    packageName: 'idris-lang/Idris-dev',
    versioning: semverVersioning.id,
    extractVersion: '^v(?<version>\\S+)',
  },
  java: (version) => {
    const adoptOpenJdkMatches = version.match(
      /^adoptopenjdk-(?<version>\d\S+)/
    );
    if (adoptOpenJdkMatches) {
      return {
        datasource: AdoptiumJavaDatasource.id,
        packageName: 'java-jdk',
        versioning: hermitVersioning.id,
        currentValue: adoptOpenJdkMatches.groups!.version,
      };
    }
    const adoptOpenJreMatches = version.match(
      /^adoptopenjdk-jre-(?<version>\d\S+)/
    );
    if (adoptOpenJreMatches) {
      return {
        datasource: AdoptiumJavaDatasource.id,
        packageName: 'java-jre',
        versioning: hermitVersioning.id,
        currentValue: adoptOpenJreMatches.groups!.version,
      };
    }

    return undefined;
  },
  julia: {
    datasource: GithubReleasesDatasource.id,
    packageName: 'JuliaLang/julia',
    versioning: semverVersioning.id,
    extractVersion: '^v(?<version>\\S+)',
  },
  just: {
    datasource: GithubReleasesDatasource.id,
    packageName: 'casey/just',
    versioning: semverVersioning.id,
  },
  kotlin: {
    datasource: GithubReleasesDatasource.id,
    packageName: 'JetBrains/kotlin',
    versioning: semverVersioning.id,
    extractVersion: '^(Kotlin |v)(?<version>\\S+)',
  },
  kustomize: {
    datasource: GithubTagsDatasource.id,
    packageName: 'kubernetes-sigs/kustomize',
    versioning: semverVersioning.id,
    extractVersion: '^kustomize/v(?<version>\\S+)',
  },
  lua: {
    datasource: GithubReleasesDatasource.id,
    packageName: 'lua/lua',
    versioning: semverVersioning.id,
    extractVersion: '^v(?<version>\\S+)',
  },
  nim: {
    datasource: GithubTagsDatasource.id,
    packageName: 'nim-lang/Nim',
    versioning: semverVersioning.id,
    extractVersion: '^v(?<version>\\S+)',
  },
  nodejs: {
    depName: 'node',
    datasource: NodeDatasource.id,
    packageName: 'node',
    versioning: nodeVersioning.id,
  },
  ocaml: {
    datasource: GithubReleasesDatasource.id,
    packageName: 'ocaml/ocaml',
    versioning: semverVersioning.id,
  },
  perl: {
    datasource: GithubTagsDatasource.id,
    packageName: 'Perl/perl5',
    versioning: semverVersioning.id,
    extractVersion: '^v(?<version>\\S+)',
  },
  php: {
    datasource: GithubTagsDatasource.id,
    packageName: 'php/php-src',
    versioning: semverVersioning.id,
    extractVersion: '^php-(?<version>\\S+)',
  },
  python: {
    datasource: GithubTagsDatasource.id,
    packageName: 'python/cpython',
    versioning: semverVersioning.id,
    extractVersion: '^v(?<version>\\S+)',
  },
  ruby: {
    datasource: 'ruby-version',
    packageName: 'ruby-version',
    versioning: semverVersioning.id,
  },
  rust: {
    datasource: GithubTagsDatasource.id,
    packageName: 'rust-lang/rust',
    versioning: semverVersioning.id,
  },
  scala: (version) => {
    if (version.startsWith('2')) {
      return {
        datasource: GithubTagsDatasource.id,
        packageName: 'scala/scala',
        versioning: semverVersioning.id,
        extractVersion: '^v(?<version>\\S+)',
      };
    }
    if (version.startsWith('3')) {
      return {
        datasource: GithubTagsDatasource.id,
        packageName: 'lampepfl/dotty',
        versioning: semverVersioning.id,
      };
    }

    return undefined;
  },
  shellcheck: {
    datasource: GithubReleasesDatasource.id,
    packageName: 'koalaman/shellcheck',
    versioning: semverVersioning.id,
    extractVersion: '^v(?<version>\\S+)',
  },
  shfmt: {
    datasource: GithubReleasesDatasource.id,
    packageName: 'mvdan/sh',
    versioning: semverVersioning.id,
    extractVersion: '^v(?<version>\\S+)',
  },
  terraform: {
    datasource: GithubTagsDatasource.id,
    packageName: 'hashicorp/terraform',
    versioning: semverVersioning.id,
    extractVersion: '^v(?<version>\\S+)',
  },
  trivy: {
    datasource: GithubTagsDatasource.id,
    packageName: 'aquasecurity/trivy',
    versioning: semverVersioning.id,
    extractVersion: '^v(?<version>\\S+)',
  },
  zig: {
    datasource: GithubTagsDatasource.id,
    packageName: 'ziglang/zig',
    versioning: semverVersioning.id,
  },
};
