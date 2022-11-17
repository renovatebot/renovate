import { AdoptiumJavaDatasource } from '../../datasource/adoptium-java';
import { DockerDatasource } from '../../datasource/docker';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { HexpmBobDatasource } from '../../datasource/hexpm-bob';
import { NodeDatasource } from '../../datasource/node';
import { RubyVersionDatasource } from '../../datasource/ruby-version';
import * as nodeVersioning from '../../versioning/node';
import * as regexVersioning from '../../versioning/regex';
import * as semverVersioning from '../../versioning/semver';
import type { PackageDependency } from '../types';

export type StaticTooling = Partial<PackageDependency> &
  Required<
    Pick<PackageDependency, 'datasource' | 'versioning' | 'packageName'>
  >;

export type DynamicTooling = (version: string) => StaticTooling | undefined;

export const upgradeableTooling: Record<
  string,
  { config: StaticTooling | DynamicTooling; asdfPluginUrl: string }
> = {
  awscli: {
    asdfPluginUrl: 'https://github.com/MetricMike/asdf-awscli',
    config: {
      datasource: GithubTagsDatasource.id,
      packageName: 'aws/aws-cli',
      versioning: semverVersioning.id,
    },
  },
  bun: {
    asdfPluginUrl: 'https://github.com/cometkim/asdf-bun',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'oven-sh/bun',
      versioning: semverVersioning.id,
      extractVersion: '^bun-v(?<version>\\S+)',
    },
  },
  'cargo-make': {
    asdfPluginUrl: 'https://github.com/kachick/asdf-cargo-make',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'sagiegurari/cargo-make',
      versioning: semverVersioning.id,
    },
  },
  clojure: {
    asdfPluginUrl: 'https://github.com/asdf-community/asdf-clojure',
    config: {
      datasource: GithubTagsDatasource.id,
      packageName: 'clojure/brew-install',
      versioning: `${regexVersioning.id}:^(?<major>\\d+?)\\.(?<minor>\\d+?)\\.(?<patch>\\d+)\\.(?<build>\\d+)$`,
    },
  },
  crystal: {
    asdfPluginUrl: 'https://github.com/asdf-community/asdf-crystal',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'crystal-lang/crystal',
      versioning: semverVersioning.id,
    },
  },
  deno: {
    asdfPluginUrl: 'https://github.com/asdf-community/asdf-deno',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'denoland/deno',
      versioning: semverVersioning.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  direnv: {
    asdfPluginUrl: 'https://github.com/asdf-community/asdf-direnv',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'direnv/direnv',
      versioning: semverVersioning.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  dprint: {
    asdfPluginUrl: 'https://github.com/asdf-community/asdf-dprint',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'dprint/dprint',
      versioning: semverVersioning.id,
    },
  },
  elixir: {
    asdfPluginUrl: 'https://github.com/asdf-vm/asdf-elixir',
    config: {
      datasource: HexpmBobDatasource.id,
      packageName: 'elixir',
      versioning: semverVersioning.id,
    },
  },
  elm: {
    asdfPluginUrl: 'https://github.com/asdf-community/asdf-elm',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'elm/compiler',
      versioning: semverVersioning.id,
    },
  },
  erlang: {
    asdfPluginUrl: 'https://github.com/asdf-vm/asdf-erlang',
    config: {
      datasource: GithubTagsDatasource.id,
      packageName: 'erlang/otp',
      extractVersion: '^OTP-(?<version>\\S+)',
      versioning: `${regexVersioning.id}:^(?<major>\\d+?)\\.(?<minor>\\d+?)(\\.(?<patch>\\d+))?$`,
    },
  },
  gauche: {
    asdfPluginUrl: 'https://github.com/sakuro/asdf-gauche',
    config: {
      datasource: DockerDatasource.id,
      packageName: 'practicalscheme/gauche',
      versioning: semverVersioning.id,
    },
  },
  golang: {
    asdfPluginUrl: 'https://github.com/kennyp/asdf-golang',
    config: {
      datasource: GithubTagsDatasource.id,
      packageName: 'golang/go',
      versioning: semverVersioning.id,
      extractVersion: '^go(?<version>\\S+)',
    },
  },
  haskell: {
    asdfPluginUrl: 'https://github.com/asdf-community/asdf-haskell',
    config: {
      datasource: GithubTagsDatasource.id,
      packageName: 'ghc/ghc',
      versioning: semverVersioning.id,
      extractVersion: '^ghc-(?<version>\\S+?)-release',
    },
  },
  helm: {
    asdfPluginUrl: 'https://github.com/Antiarchitect/asdf-helm',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'helm/helm',
      versioning: semverVersioning.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  helmfile: {
    asdfPluginUrl: 'https://github.com/feniix/asdf-helmfile',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'helmfile/helmfile',
      versioning: semverVersioning.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  hugo: {
    asdfPluginUrl: 'https://github.com/NeoHsu/asdf-hugo',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'gohugoio/hugo',
      versioning: semverVersioning.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  idris: {
    asdfPluginUrl: 'https://github.com/asdf-community/asdf-idris',
    config: {
      datasource: GithubTagsDatasource.id,
      packageName: 'idris-lang/Idris-dev',
      versioning: semverVersioning.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  java: {
    asdfPluginUrl: 'https://github.com/halcyon/asdf-java',
    config: (version) => {
      const adoptOpenJdkMatches = version.match(
        /^adoptopenjdk-(?<version>\d\S+)/
      );
      if (adoptOpenJdkMatches) {
        return {
          datasource: AdoptiumJavaDatasource.id,
          packageName: 'java-jdk',
          versioning: semverVersioning.id,
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
          versioning: semverVersioning.id,
          currentValue: adoptOpenJreMatches.groups!.version,
        };
      }

      return undefined;
    },
  },
  julia: {
    asdfPluginUrl: 'https://github.com/rkyleg/asdf-julia',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'JuliaLang/julia',
      versioning: semverVersioning.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  just: {
    asdfPluginUrl: 'https://github.com/olofvndrhr/asdf-just',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'casey/just',
      versioning: semverVersioning.id,
    },
  },
  kotlin: {
    asdfPluginUrl: 'https://github.com/asdf-community/asdf-kotlin',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'JetBrains/kotlin',
      versioning: semverVersioning.id,
      extractVersion: '^(Kotlin |v)(?<version>\\S+)',
    },
  },
  kustomize: {
    asdfPluginUrl: 'https://github.com/Banno/asdf-kustomize',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'kubernetes-sigs/kustomize',
      versioning: semverVersioning.id,
      extractVersion: '^kustomize/v(?<version>\\S+)',
    },
  },
  lua: {
    asdfPluginUrl: 'https://github.com/Stratus3D/asdf-lua',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'lua/lua',
      versioning: semverVersioning.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  nim: {
    asdfPluginUrl: 'https://github.com/asdf-community/asdf-nim',
    config: {
      datasource: GithubTagsDatasource.id,
      packageName: 'nim-lang/Nim',
      versioning: semverVersioning.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  nodejs: {
    asdfPluginUrl: 'https://github.com/asdf-vm/asdf-nodejs',
    config: {
      depName: 'node',
      datasource: NodeDatasource.id,
      packageName: 'node',
      versioning: nodeVersioning.id,
    },
  },
  ocaml: {
    asdfPluginUrl: 'https://github.com/asdf-community/asdf-ocaml',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'ocaml/ocaml',
      versioning: semverVersioning.id,
    },
  },
  perl: {
    asdfPluginUrl: 'https://github.com/ouest/asdf-perl',
    config: {
      datasource: GithubTagsDatasource.id,
      packageName: 'Perl/perl5',
      versioning: semverVersioning.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  php: {
    asdfPluginUrl: 'https://github.com/asdf-community/asdf-php',
    config: {
      datasource: GithubTagsDatasource.id,
      packageName: 'php/php-src',
      versioning: semverVersioning.id,
      extractVersion: '^php-(?<version>\\S+)',
    },
  },
  python: {
    asdfPluginUrl: 'https://github.com/danhper/asdf-python',
    config: {
      datasource: GithubTagsDatasource.id,
      packageName: 'python/cpython',
      versioning: semverVersioning.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  ruby: {
    asdfPluginUrl: 'https://github.com/asdf-vm/asdf-ruby',
    config: {
      datasource: RubyVersionDatasource.id,
      packageName: 'ruby-version',
      versioning: semverVersioning.id,
    },
  },
  rust: {
    asdfPluginUrl: 'https://github.com/code-lever/asdf-rust',
    config: {
      datasource: GithubTagsDatasource.id,
      packageName: 'rust-lang/rust',
      versioning: semverVersioning.id,
    },
  },
  scala: {
    asdfPluginUrl: 'https://github.com/asdf-community/asdf-scala',
    config: (version) => {
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
  },
  shellcheck: {
    asdfPluginUrl: 'https://github.com/luizm/asdf-shellcheck',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'koalaman/shellcheck',
      versioning: semverVersioning.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  shfmt: {
    asdfPluginUrl: 'https://github.com/luizm/asdf-shfmt',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'mvdan/sh',
      versioning: semverVersioning.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  terraform: {
    asdfPluginUrl: 'https://github.com/asdf-community/asdf-hashicorp',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'hashicorp/terraform',
      versioning: semverVersioning.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  trivy: {
    asdfPluginUrl: 'https://github.com/zufardhiyaulhaq/asdf-trivy',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'aquasecurity/trivy',
      versioning: semverVersioning.id,
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  zig: {
    asdfPluginUrl: 'https://github.com/cheetah/asdf-zig',
    config: {
      datasource: GithubTagsDatasource.id,
      packageName: 'ziglang/zig',
      versioning: semverVersioning.id,
    },
  },
};
