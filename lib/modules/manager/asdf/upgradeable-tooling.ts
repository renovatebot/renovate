import { regEx } from '../../../util/regex';
import { DartVersionDatasource } from '../../datasource/dart-version';
import { DockerDatasource } from '../../datasource/docker';
import { DotnetVersionDatasource } from '../../datasource/dotnet-version';
import { FlutterVersionDatasource } from '../../datasource/flutter-version';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { HexpmBobDatasource } from '../../datasource/hexpm-bob';
import { JavaVersionDatasource } from '../../datasource/java-version';
import { NodeVersionDatasource } from '../../datasource/node-version';
import { NpmDatasource } from '../../datasource/npm';
import { PypiDatasource } from '../../datasource/pypi';
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
  act: {
    asdfPluginUrl: 'https://github.com/grimoh/asdf-act.git',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'nektos/act',
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  actionlint: {
    asdfPluginUrl: 'https://github.com/crazy-matt/asdf-actionlint',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'rhysd/actionlint',
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  'adr-tools': {
    asdfPluginUrl: 'https://gitlab.com/td7x/asdf/adr-tools.git',
    config: {
      datasource: GithubTagsDatasource.id,
      packageName: 'npryce/adr-tools',
    },
  },
  argocd: {
    asdfPluginUrl: 'https://github.com/beardix/asdf-argocd',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'argoproj/argo-cd',
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  'asdf-plugin-manager': {
    asdfPluginUrl: 'https://github.com/asdf-community/asdf-plugin-manager',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'asdf-community/asdf-plugin-manager',
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  atmos: {
    asdfPluginUrl: 'https://github.com/cloudposse/asdf-atmos',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'cloudposse/atmos',
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
    asdfPluginUrl: 'https://github.com/mise-plugins/asdf-cargo-make',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'sagiegurari/cargo-make',
    },
  },
  checkov: {
    asdfPluginUrl: 'https://github.com/bosmak/asdf-checkov.git',
    config: {
      datasource: GithubTagsDatasource.id,
      packageName: 'bridgecrewio/checkov',
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
  cookiecutter: {
    asdfPluginUrl: 'https://github.com/shawon-crosen/asdf-cookiecutter',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'cookiecutter/cookiecutter',
      versioning: semverVersioning.id,
    },
  },
  cosign: {
    asdfPluginUrl: 'https://gitlab.com/wt0f/asdf-cosign',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'sigstore/cosign',
      extractVersion: '^v(?<version>\\S+)',
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
  'dotnet-core': {
    asdfPluginUrl: 'https://github.com/emersonsoares/asdf-dotnet-core',
    config: {
      datasource: DotnetVersionDatasource.id,
      packageName: 'dotnet-sdk',
    },
  },
  dprint: {
    asdfPluginUrl: 'https://github.com/asdf-community/asdf-dprint',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'dprint/dprint',
    },
  },
  ecspresso: {
    asdfPluginUrl: 'https://github.com/kayac/asdf-ecspresso',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'kayac/ecspresso',
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  'editorconfig-checker': {
    asdfPluginUrl: 'https://github.com/gabitchov/asdf-editorconfig-checker',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'editorconfig-checker/editorconfig-checker',
      extractVersion: '^v(?<version>\\S+)',
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
    config: (version) => ({
      datasource: FlutterVersionDatasource.id,
      // asdf-flutter plugin supports channel on version suffix.
      currentValue: version.replace(regEx(/-(stable|beta|dev)$/), ''),
    }),
  },
  flux2: {
    asdfPluginUrl: 'https://github.com/tablexi/asdf-flux2.git',
    config: {
      datasource: GithubTagsDatasource.id,
      packageName: 'fluxcd/flux2',
      extractVersion: '^v(?<version>.+)',
    },
  },
  gauche: {
    asdfPluginUrl: 'https://github.com/sakuro/asdf-gauche',
    config: {
      datasource: DockerDatasource.id,
      packageName: 'practicalscheme/gauche',
    },
  },
  'github-cli': {
    asdfPluginUrl: 'https://github.com/bartlomiejdanek/asdf-github-cli.git',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'cli/cli',
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  gitleaks: {
    asdfPluginUrl: 'https://github.com/jmcvetta/asdf-gitleaks',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'gitleaks/gitleaks',
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  gleam: {
    asdfPluginUrl: 'https://github.com/asdf-community/asdf-gleam.git',
    config: {
      datasource: GithubTagsDatasource.id,
      packageName: 'gleam-lang/gleam',
      extractVersion: '^v(?<version>.+)',
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
  'golangci-lint': {
    asdfPluginUrl: 'https://github.com/hypnoglow/asdf-golangci-lint.git',
    config: {
      datasource: GithubTagsDatasource.id,
      packageName: 'golangci/golangci-lint',
      extractVersion: '^v(?<version>.+)',
    },
  },
  gomplate: {
    asdfPluginUrl: 'https://github.com/sneakybeaky/asdf-gomplate',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'hairyhenderson/gomplate',
      extractVersion: '^v(?<version>.+)',
    },
  },
  hadolint: {
    asdfPluginUrl: 'https://github.com/looztra/asdf-hadolint.git',
    config: {
      datasource: GithubTagsDatasource.id,
      packageName: 'hadolint/hadolint',
      extractVersion: '^v(?<version>.+)',
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
  istioctl: {
    asdfPluginUrl: 'https://github.com/virtualstaticvoid/asdf-istioctl',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'istio/istio',
      versioning: semverVersioning.id,
    },
  },
  java: {
    asdfPluginUrl: 'https://github.com/halcyon/asdf-java',
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
  k3s: {
    asdfPluginUrl: 'https://github.com/dmpe/asdf-k3s',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'k3s-io/k3s',
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  kind: {
    asdfPluginUrl: 'https://github.com/johnlayton/asdf-kind',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'kubernetes-sigs/kind',
      extractVersion: '^v(?<version>\\S+)',
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
  kubectl: {
    asdfPluginUrl: 'https://github.com/Banno/asdf-kubectl.git',
    config: {
      datasource: GithubTagsDatasource.id,
      packageName: 'kubernetes/kubernetes',
      extractVersion: '^v(?<version>.+)',
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
  'markdownlint-cli2': {
    asdfPluginUrl:
      'https://github.com/paulo-ferraz-oliveira/asdf-markdownlint-cli2',
    config: {
      datasource: GithubTagsDatasource.id,
      packageName: 'DavidAnson/markdownlint-cli2',
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  maven: {
    asdfPluginUrl: 'https://github.com/halcyon/asdf-maven',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'apache/maven',
    },
  },
  mimirtool: {
    asdfPluginUrl: 'https://github.com/asdf-community/asdf-mimirtool',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'grafana/mimir',
      extractVersion: '^mimir-(?<version>\\S+)',
    },
  },
  minikube: {
    asdfPluginUrl: 'https://github.com/alvarobp/asdf-minikube.git',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'kubernetes/minikube',
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
      datasource: NodeVersionDatasource.id,
    },
  },
  ocaml: {
    asdfPluginUrl: 'https://github.com/asdf-community/asdf-ocaml',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'ocaml/ocaml',
    },
  },
  oci: {
    asdfPluginUrl: 'https://github.com/yasn77/asdf-oci',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'oracle/oci-cli',
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  opentofu: {
    asdfPluginUrl: 'https://github.com/virtualroot/asdf-opentofu',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'opentofu/opentofu',
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  packer: {
    asdfPluginUrl: 'https://github.com/asdf-community/asdf-hashicorp',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'hashicorp/packer',
      extractVersion: '^v(?<version>\\S+)',
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
  poetry: {
    asdfPluginUrl: 'https://github.com/asdf-community/asdf-poetry',
    config: {
      datasource: PypiDatasource.id,
      packageName: 'poetry',
    },
  },
  'pre-commit': {
    asdfPluginUrl: 'https://github.com/jonathanmorley/asdf-pre-commit.git',
    config: {
      datasource: GithubTagsDatasource.id,
      packageName: 'pre-commit/pre-commit',
      extractVersion: '^v(?<version>.+)',
    },
  },
  protoc: {
    asdfPluginUrl: 'https://github.com/paxosglobal/asdf-protoc.git',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'protocolbuffers/protobuf',
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  pulumi: {
    asdfPluginUrl: 'https://github.com/canha/asdf-pulumi.git',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'pulumi/pulumi',
      extractVersion: '^v(?<version>\\S+)',
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
  rebar: {
    asdfPluginUrl: 'https://github.com/Stratus3D/asdf-rebar.git',
    config: {
      datasource: GithubTagsDatasource.id,
      packageName: 'erlang/rebar3',
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
  sbt: {
    asdfPluginUrl: 'https://github.com/bram2000/asdf-sbt.git',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'sbt/sbt',
      extractVersion: '^v(?<version>\\S+)',
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
  sops: {
    asdfPluginUrl: 'https://github.com/feniix/asdf-sops',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'mozilla/sops',
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  steampipe: {
    asdfPluginUrl: 'https://github.com/carnei-ro/asdf-steampipe',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'turbot/steampipe',
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
  'terraform-docs': {
    asdfPluginUrl: 'https://github.com/looztra/asdf-terraform-docs.git',
    config: {
      datasource: GithubTagsDatasource.id,
      packageName: 'terraform-docs/terraform-docs',
      extractVersion: '^v(?<version>.+)',
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
  tflint: {
    asdfPluginUrl: 'https://github.com/skyzyx/asdf-tflint.git',
    config: {
      datasource: GithubTagsDatasource.id,
      packageName: 'terraform-linters/tflint',
      extractVersion: '^v(?<version>.+)',
    },
  },
  tfsec: {
    asdfPluginUrl: 'https://github.com/woneill/asdf-tfsec.git',
    config: {
      datasource: GithubTagsDatasource.id,
      packageName: 'aquasecurity/tfsec',
      extractVersion: '^v(?<version>.+)',
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
  vault: {
    asdfPluginUrl: 'https://github.com/asdf-community/asdf-hashicorp',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'hashicorp/vault',
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  yamllint: {
    asdfPluginUrl: 'https://github.com/ericcornelissen/asdf-yamllint',
    config: {
      datasource: GithubTagsDatasource.id,
      packageName: 'adrienverge/yamllint',
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  yq: {
    asdfPluginUrl: 'https://github.com/sudermanjr/asdf-yq',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'mikefarah/yq',
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
  maestro: {
    asdfPluginUrl: 'https://github.com/dotanuki-labs/asdf-maestro',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'mobile-dev-inc/maestro',
      extractVersion: '^cli-(?<version>\\S+)',
    },
  },
  detekt: {
    asdfPluginUrl: 'https://github.com/dotanuki-labs/asdf-detekt',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'detekt/detekt',
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  ktlint: {
    asdfPluginUrl: 'https://github.com/asdf-community/asdf-ktlint',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'pinterest/ktlint',
    },
  },
  yamlfmt: {
    asdfPluginUrl: 'https://github.com/mise-plugins/asdf-yamlfmt',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'google/yamlfmt',
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  tuist: {
    asdfPluginUrl: 'https://github.com/asdf-community/asdf-tuist',
    config: {
      datasource: GithubTagsDatasource.id,
      packageName: 'tuist/tuist',
    },
  },
  typos: {
    asdfPluginUrl: 'https://github.com/aschiavon91/asdf-typos',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'crate-ci/typos',
      extractVersion: '^v(?<version>\\S+)',
    },
  },
  uv: {
    asdfPluginUrl: 'https://github.com/asdf-community/asdf-uv',
    config: {
      datasource: GithubReleasesDatasource.id,
      packageName: 'astral-sh/uv',
    },
  },
};
