import { DartVersionDatasource } from '../../datasource/dart-version';
import { DockerDatasource } from '../../datasource/docker';
import { FlutterVersionDatasource } from '../../datasource/flutter-version';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { HexpmBobDatasource } from '../../datasource/hexpm-bob';
import { JavaVersionDatasource } from '../../datasource/java-version';
import { NodeDatasource } from '../../datasource/node';
import { NpmDatasource } from '../../datasource/npm';
import { RubyVersionDatasource } from '../../datasource/ruby-version';
import * as regexVersioning from '../../versioning/regex';
import * as semverVersioning from '../../versioning/semver';
import type { PackageDependency } from '../types';

export type StaticTooling = Partial<PackageDependency> &
  Required<Pick<PackageDependency, 'datasource'>>;

export type DynamicTooling = (version: string) => StaticTooling | undefined;

export type ToolingConfig = StaticTooling | DynamicTooling;
export interface ToolingDefinition {
  config: ToolingConfig;
  asdfPluginUrl: string;
}

const hugoDefinition: ToolingDefinition = {
  // This plugin supports the names `hugo` & `gohugo`
  asdfPluginUrl: 'https://github.com/NeoHsu/asdf-hugo',
  config: (version) => ({
    datasource: GithubReleasesDatasource.id,
    packageName: 'gohugoio/hugo',
    extractVersion: '^v(?<version>\\S+)',
    // The asdf hugo plugin supports prefixing the version with
    // `extended_`. Extended versions feature Sass support.
    currentValue: version.replace(/^extended_/, ''),
  }),
};

export const upgradeableTooling: Record<string, ToolingDefinition> = {
  argocd: {
    asdfPluginUrl: 'https://github.com/beardix/asdf-argocd',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'argoproj/argo-cd',
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  awscli: {
    asdfPluginUrl: 'https://github.com/MetricMike/asdf-awscli',
    config: {
      datasource: GithubTagsDatasource.id,
      packageName: 'aws/aws-cli',
    },
  },
  bun: {
    asdfPluginUrl: 'https://github.com/cometkim/asdf-bun',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'oven-sh/bun',
      extractVersion: '^bun-v(?<version>\\S+)',
    },
  },
  'cargo-make': {
    asdfPluginUrl: 'https://github.com/kachick/asdf-cargo-make',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'sagiegurari/cargo-make',
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
    },
  },
  dart: {
    asdfPluginUrl: 'https://github.com/PatOConnor43/asdf-dart',
    config: {
      datasource: DartVersionDatasource.id,
    },
  },
  deno: {
    asdfPluginUrl: 'https://github.com/asdf-community/asdf-deno',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'denoland/deno',
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  direnv: {
    asdfPluginUrl: 'https://github.com/asdf-community/asdf-direnv',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'direnv/direnv',
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  dprint: {
    asdfPluginUrl: 'https://github.com/asdf-community/asdf-dprint',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'dprint/dprint',
    },
  },
  elixir: {
    asdfPluginUrl: 'https://github.com/asdf-vm/asdf-elixir',
    config: {
      datasource: HexpmBobDatasource.id,
    },
  },
  elm: {
    asdfPluginUrl: 'https://github.com/asdf-community/asdf-elm',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'elm/compiler',
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
  flutter: {
    asdfPluginUrl: 'https://github.com/oae/asdf-flutter',
    config: {
      datasource: FlutterVersionDatasource.id,
    },
  },
  gauche: {
    asdfPluginUrl: 'https://github.com/sakuro/asdf-gauche',
    config: {
      datasource: DockerDatasource.id,
      packageName: 'practicalscheme/gauche',
    },
  },
  gohugo: hugoDefinition,
  golang: {
    asdfPluginUrl: 'https://github.com/kennyp/asdf-golang',
    config: {
      datasource: GithubTagsDatasource.id,
      packageName: 'golang/go',
      extractVersion: '^go(?<version>\\S+)',
    },
  },
  haskell: {
    asdfPluginUrl: 'https://github.com/asdf-community/asdf-haskell',
    config: {
      datasource: GithubTagsDatasource.id,
      packageName: 'ghc/ghc',
      extractVersion: '^ghc-(?<version>\\S+?)-release',
    },
  },
  helm: {
    asdfPluginUrl: 'https://github.com/Antiarchitect/asdf-helm',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'helm/helm',
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  helmfile: {
    asdfPluginUrl: 'https://github.com/feniix/asdf-helmfile',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'helmfile/helmfile',
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  hugo: hugoDefinition,
  idris: {
    asdfPluginUrl: 'https://github.com/asdf-community/asdf-idris',
    config: {
      datasource: GithubTagsDatasource.id,
      packageName: 'idris-lang/Idris-dev',
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
          datasource: JavaVersionDatasource.id,
          packageName: 'java-jdk',
          currentValue: adoptOpenJdkMatches.groups!.version,
        };
      }
      const adoptOpenJreMatches = version.match(
        /^adoptopenjdk-jre-(?<version>\d\S+)/
      );
      if (adoptOpenJreMatches) {
        return {
          datasource: JavaVersionDatasource.id,
          packageName: 'java-jre',
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
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  just: {
    asdfPluginUrl: 'https://github.com/olofvndrhr/asdf-just',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'casey/just',
    },
  },
  kotlin: {
    asdfPluginUrl: 'https://github.com/asdf-community/asdf-kotlin',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'JetBrains/kotlin',
      extractVersion: '^(Kotlin |v)(?<version>\\S+)',
    },
  },
  kustomize: {
    asdfPluginUrl: 'https://github.com/Banno/asdf-kustomize',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'kubernetes-sigs/kustomize',
      extractVersion: '^kustomize/v(?<version>\\S+)',
    },
  },
  lua: {
    asdfPluginUrl: 'https://github.com/Stratus3D/asdf-lua',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'lua/lua',
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  nim: {
    asdfPluginUrl: 'https://github.com/asdf-community/asdf-nim',
    config: {
      datasource: GithubTagsDatasource.id,
      packageName: 'nim-lang/Nim',
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  nodejs: {
    asdfPluginUrl: 'https://github.com/asdf-vm/asdf-nodejs',
    config: {
      depName: 'node',
      datasource: NodeDatasource.id,
    },
  },
  ocaml: {
    asdfPluginUrl: 'https://github.com/asdf-community/asdf-ocaml',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'ocaml/ocaml',
    },
  },
  perl: {
    asdfPluginUrl: 'https://github.com/ouest/asdf-perl',
    config: {
      datasource: GithubTagsDatasource.id,
      packageName: 'Perl/perl5',
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  php: {
    asdfPluginUrl: 'https://github.com/asdf-community/asdf-php',
    config: {
      datasource: GithubTagsDatasource.id,
      packageName: 'php/php-src',
      extractVersion: '^php-(?<version>\\S+)',
    },
  },
  pnpm: {
    asdfPluginUrl: 'https://github.com/jonathanmorley/asdf-pnpm',
    config: {
      datasource: NpmDatasource.id,
      packageName: 'pnpm',
      versioning: semverVersioning.id,
    },
  },
  pulumi: {
    asdfPluginUrl: 'https://github.com/canha/asdf-pulumi.git',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'pulumi/pulumi',
      versioning: '^v(?<version>\\S+)',
    },
  },
  python: {
    asdfPluginUrl: 'https://github.com/danhper/asdf-python',
    config: {
      datasource: GithubTagsDatasource.id,
      packageName: 'python/cpython',
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
    },
  },
  scala: {
    asdfPluginUrl: 'https://github.com/asdf-community/asdf-scala',
    config: (version) => {
      if (version.startsWith('2')) {
        return {
          datasource: GithubTagsDatasource.id,
          packageName: 'scala/scala',
          extractVersion: '^v(?<version>\\S+)',
        };
      }
      if (version.startsWith('3')) {
        return {
          datasource: GithubTagsDatasource.id,
          packageName: 'lampepfl/dotty',
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
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  shfmt: {
    asdfPluginUrl: 'https://github.com/luizm/asdf-shfmt',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'mvdan/sh',
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  terraform: {
    asdfPluginUrl: 'https://github.com/asdf-community/asdf-hashicorp',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'hashicorp/terraform',
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  terragrunt: {
    asdfPluginUrl: 'https://github.com/ohmer/asdf-terragrunt',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'gruntwork-io/terragrunt',
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  trivy: {
    asdfPluginUrl: 'https://github.com/zufardhiyaulhaq/asdf-trivy',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'aquasecurity/trivy',
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  zig: {
    asdfPluginUrl: 'https://github.com/cheetah/asdf-zig',
    config: {
      datasource: GithubTagsDatasource.id,
      packageName: 'ziglang/zig',
    },
  },
};
