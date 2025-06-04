import { codeBlock } from 'common-tags';
import { extractPackageFile } from '.';

describe('modules/manager/asdf/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns a result', () => {
      const res = extractPackageFile('nodejs 16.16.0\n');
      expect(res).toEqual({
        deps: [
          {
            currentValue: '16.16.0',
            datasource: 'node-version',
            depName: 'node',
          },
        ],
      });
    });

    it('provides skipReason for lines with unsupported tooling', () => {
      const res = extractPackageFile('unsupported 1.22.5\n');
      expect(res).toEqual({
        deps: [
          {
            depName: 'unsupported',
            skipReason: 'unsupported-datasource',
          },
        ],
      });
    });

    it('only captures the first version', () => {
      const res = extractPackageFile('nodejs 16.16.0 16.15.1');
      expect(res).toEqual({
        deps: [
          {
            currentValue: '16.16.0',
            datasource: 'node-version',
            depName: 'node',
          },
        ],
      });
    });

    it('can handle multiple tools in one file', () => {
      const res = extractPackageFile(
        codeBlock`
act 0.2.54
actionlint 0.7.0
adr-tools 3.0.0
argocd 2.5.4
asdf-plugin-manager 1.1.1
atmos 1.100.0
awscli 2.8.6
azure-cli 2.70.0
bun 0.2.2
cargo-make 0.36.2
checkov 2.3.3
clojure 1.11.1.1182
clusterctl 1.9.8
conftest 0.56.0
container-structure-test 1.19.2
cosign 2.2.4
crystal 1.6.1
dart 2.19.3
deno 1.26.2
direnv 2.32.1
dotnet-core 8.0.303
dprint 0.32.2
ecspresso 2.1.0
editorconfig-checker 3.0.2
elixir 1.14.1
elm 0.19.1
erlang 25.1.2
flutter 3.7.6-stable
flux2 0.41.2
gauche 0.9.12
github-cli 2.32.1
gitleaks 8.21.1
ginkgo 2.22.2
gleam 1.3.1
gohugo extended_0.104.3
golang 1.23.3
golangci-lint 1.52.2
gomplate 3.11.7
hadolint 2.12.0
haskell 9.4.2
helm 3.10.1
helm-docs 1.14.1
helmfile 0.147.0
hugo 0.104.3
idris 1.3.4
java adoptopenjdk-16.0.0+36
julia 1.8.2
just 1.7.0
k3s 1.31.2+k3s1
kind 0.19.0
kotlin 1.7.20
kubebuilder 3.10.0
kubectl 1.26.3
kubetail 1.6.19
kustomize 4.5.7
lua 5.4.4
markdownlint-cli2 0.13.0
maven 3.9.6
mimirtool 2.11.0
minikube 1.33.1
nim 1.6.8
nodejs 18.12.0
ocaml 4.14.0
oci 3.50.0
opa 1.2.0
opentofu 1.6.0
packer 1.11.2
perl 5.37.5
php 8.1.12
pnpm 7.26.2
poetry 1.3.2
pre-commit 3.3.1
protoc 28.3
pulumi 3.57.1
python 3.11.0
rebar 3.23.0
ruby 3.1.2
rust 1.64.0
sbt 1.9.7
scala 3.2.1
shellcheck 0.8.0
shfmt 3.5.1
skaffold 2.14.0
talhelper 3.0.18
talosctl 1.9.3
terraform 1.3.3
terraform-docs 0.16.0
terraformer 0.8.21
terragrunt 0.43.2
terramate 0.12.1
tflint 0.44.1
tfsec 1.28.1
trivy 0.33.0
vault 1.15.1
yamllint 1.35.0
yq 4.40.5
zig 0.9.1
maestro 1.24.0
detekt 1.21.0
ktlint 0.48.1
yamlfmt 0.9.0
typos 1.16.1
steampipe 0.20.10
dummy 1.2.3
`,
      );
      expect(res).toEqual({
        deps: [
          {
            currentValue: '0.2.54',
            datasource: 'github-releases',
            packageName: 'nektos/act',
            depName: 'act',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '0.7.0',
            datasource: 'github-releases',
            packageName: 'rhysd/actionlint',
            depName: 'actionlint',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '3.0.0',
            datasource: 'github-tags',
            packageName: 'npryce/adr-tools',
            depName: 'adr-tools',
          },
          {
            currentValue: '2.5.4',
            datasource: 'github-releases',
            packageName: 'argoproj/argo-cd',
            depName: 'argocd',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '1.1.1',
            datasource: 'github-releases',
            packageName: 'asdf-community/asdf-plugin-manager',
            depName: 'asdf-plugin-manager',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '1.100.0',
            datasource: 'github-releases',
            packageName: 'cloudposse/atmos',
            depName: 'atmos',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '2.8.6',
            datasource: 'github-tags',
            packageName: 'aws/aws-cli',
            depName: 'awscli',
          },
          {
            currentValue: '2.70.0',
            datasource: 'github-releases',
            packageName: 'Azure/azure-cli',
            depName: 'azure-cli',
            extractVersion: '^azure-cli-(?<version>\\S+)',
          },
          {
            currentValue: '0.2.2',
            datasource: 'github-releases',
            packageName: 'oven-sh/bun',
            depName: 'bun',
            extractVersion: '^bun-v(?<version>\\S+)',
          },
          {
            currentValue: '0.36.2',
            datasource: 'github-releases',
            packageName: 'sagiegurari/cargo-make',
            depName: 'cargo-make',
          },
          {
            currentValue: '2.3.3',
            datasource: 'github-tags',
            packageName: 'bridgecrewio/checkov',
            depName: 'checkov',
          },
          {
            currentValue: '1.11.1.1182',
            datasource: 'github-tags',
            packageName: 'clojure/brew-install',
            versioning:
              'regex:^(?<major>\\d+?)\\.(?<minor>\\d+?)\\.(?<patch>\\d+)\\.(?<build>\\d+)$',
            depName: 'clojure',
          },
          {
            currentValue: '1.9.8',
            datasource: 'github-releases',
            packageName: 'kubernetes-sigs/cluster-api',
            depName: 'clusterctl',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '0.56.0',
            datasource: 'github-releases',
            packageName: 'open-policy-agent/conftest',
            depName: 'conftest',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '1.19.2',
            datasource: 'github-tags',
            packageName: 'GoogleContainerTools/container-structure-test',
            depName: 'container-structure-test',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '2.2.4',
            datasource: 'github-releases',
            packageName: 'sigstore/cosign',
            depName: 'cosign',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '1.6.1',
            datasource: 'github-releases',
            packageName: 'crystal-lang/crystal',
            depName: 'crystal',
          },
          {
            currentValue: '2.19.3',
            datasource: 'dart-version',
            depName: 'dart',
          },
          {
            currentValue: '1.26.2',
            datasource: 'github-releases',
            packageName: 'denoland/deno',
            depName: 'deno',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '2.32.1',
            datasource: 'github-releases',
            packageName: 'direnv/direnv',
            depName: 'direnv',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '8.0.303',
            datasource: 'dotnet-version',
            packageName: 'dotnet-sdk',
            depName: 'dotnet-core',
          },
          {
            currentValue: '0.32.2',
            datasource: 'github-releases',
            packageName: 'dprint/dprint',
            depName: 'dprint',
          },
          {
            currentValue: '2.1.0',
            datasource: 'github-releases',
            packageName: 'kayac/ecspresso',
            depName: 'ecspresso',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '3.0.2',
            datasource: 'github-releases',
            packageName: 'editorconfig-checker/editorconfig-checker',
            depName: 'editorconfig-checker',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '1.14.1',
            datasource: 'hexpm-bob',
            depName: 'elixir',
          },
          {
            currentValue: '0.19.1',
            datasource: 'github-releases',
            packageName: 'elm/compiler',
            depName: 'elm',
          },
          {
            currentValue: '25.1.2',
            datasource: 'github-tags',
            packageName: 'erlang/otp',
            extractVersion: '^OTP-(?<version>\\S+)',
            versioning:
              'regex:^(?<major>\\d+?)\\.(?<minor>\\d+?)(\\.(?<patch>\\d+))?$',
            depName: 'erlang',
          },
          {
            currentValue: '3.7.6',
            datasource: 'flutter-version',
            depName: 'flutter',
          },
          {
            currentValue: '0.41.2',
            datasource: 'github-tags',
            packageName: 'fluxcd/flux2',
            depName: 'flux2',
            extractVersion: '^v(?<version>.+)',
          },
          {
            currentValue: '0.9.12',
            datasource: 'docker',
            packageName: 'practicalscheme/gauche',
            depName: 'gauche',
          },
          {
            currentValue: '2.32.1',
            datasource: 'github-releases',
            packageName: 'cli/cli',
            depName: 'github-cli',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '8.21.1',
            datasource: 'github-releases',
            packageName: 'gitleaks/gitleaks',
            depName: 'gitleaks',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '2.22.2',
            datasource: 'github-releases',
            packageName: 'onsi/ginkgo',
            depName: 'ginkgo',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '1.3.1',
            datasource: 'github-tags',
            packageName: 'gleam-lang/gleam',
            depName: 'gleam',
            extractVersion: '^v(?<version>.+)',
          },
          {
            currentValue: '0.104.3',
            datasource: 'github-releases',
            packageName: 'gohugoio/hugo',
            depName: 'gohugo',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '1.23.3',
            datasource: 'github-tags',
            packageName: 'golang/go',
            depName: 'golang',
            extractVersion: '^go(?<version>\\S+)',
          },
          {
            currentValue: '1.52.2',
            datasource: 'github-tags',
            packageName: 'golangci/golangci-lint',
            depName: 'golangci-lint',
            extractVersion: '^v(?<version>.+)',
          },
          {
            currentValue: '3.11.7',
            datasource: 'github-releases',
            packageName: 'hairyhenderson/gomplate',
            depName: 'gomplate',
            extractVersion: '^v(?<version>.+)',
          },
          {
            currentValue: '2.12.0',
            datasource: 'github-tags',
            packageName: 'hadolint/hadolint',
            depName: 'hadolint',
            extractVersion: '^v(?<version>.+)',
          },
          {
            currentValue: '9.4.2',
            datasource: 'github-tags',
            packageName: 'ghc/ghc',
            depName: 'haskell',
            extractVersion: '^ghc-(?<version>\\S+?)-release',
          },
          {
            currentValue: '3.10.1',
            datasource: 'github-releases',
            packageName: 'helm/helm',
            depName: 'helm',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '1.14.1',
            datasource: 'github-releases',
            packageName: 'norwoodj/helm-docs',
            depName: 'helm-docs',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '0.147.0',
            datasource: 'github-releases',
            packageName: 'helmfile/helmfile',
            depName: 'helmfile',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '0.104.3',
            datasource: 'github-releases',
            packageName: 'gohugoio/hugo',
            depName: 'hugo',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '1.3.4',
            datasource: 'github-tags',
            packageName: 'idris-lang/Idris-dev',
            depName: 'idris',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '16.0.0+36',
            datasource: 'java-version',
            packageName: 'java-jdk',
            depName: 'java',
          },
          {
            currentValue: '1.8.2',
            datasource: 'github-releases',
            packageName: 'JuliaLang/julia',
            depName: 'julia',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '1.7.0',
            datasource: 'github-releases',
            packageName: 'casey/just',
            depName: 'just',
          },
          {
            currentValue: '1.31.2+k3s1',
            datasource: 'github-releases',
            packageName: 'k3s-io/k3s',
            depName: 'k3s',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '0.19.0',
            datasource: 'github-releases',
            packageName: 'kubernetes-sigs/kind',
            depName: 'kind',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '1.7.20',
            datasource: 'github-releases',
            packageName: 'JetBrains/kotlin',
            depName: 'kotlin',
            extractVersion: '^(Kotlin |v)(?<version>\\S+)',
          },
          {
            currentValue: '3.10.0',
            datasource: 'github-tags',
            packageName: 'kubernetes-sigs/kubebuilder',
            depName: 'kubebuilder',
            extractVersion: '^v(?<version>.+)',
          },
          {
            currentValue: '1.26.3',
            datasource: 'github-tags',
            packageName: 'kubernetes/kubernetes',
            depName: 'kubectl',
            extractVersion: '^v(?<version>.+)',
          },
          {
            currentValue: '1.6.19',
            datasource: 'github-releases',
            packageName: 'johanhaleby/kubetail',
            depName: 'kubetail',
          },
          {
            currentValue: '4.5.7',
            datasource: 'github-releases',
            packageName: 'kubernetes-sigs/kustomize',
            depName: 'kustomize',
            extractVersion: '^kustomize/v(?<version>\\S+)',
          },
          {
            currentValue: '5.4.4',
            datasource: 'github-releases',
            packageName: 'lua/lua',
            depName: 'lua',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '0.13.0',
            datasource: 'github-tags',
            packageName: 'DavidAnson/markdownlint-cli2',
            depName: 'markdownlint-cli2',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '3.9.6',
            datasource: 'github-releases',
            packageName: 'apache/maven',
            depName: 'maven',
          },
          {
            currentValue: '2.11.0',
            datasource: 'github-releases',
            packageName: 'grafana/mimir',
            depName: 'mimirtool',
            extractVersion: '^mimir-(?<version>\\S+)',
          },
          {
            currentValue: '1.33.1',
            datasource: 'github-releases',
            packageName: 'kubernetes/minikube',
            depName: 'minikube',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '1.6.8',
            datasource: 'github-tags',
            packageName: 'nim-lang/Nim',
            depName: 'nim',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '18.12.0',
            datasource: 'node-version',
            depName: 'node',
          },
          {
            currentValue: '4.14.0',
            datasource: 'github-releases',
            packageName: 'ocaml/ocaml',
            depName: 'ocaml',
          },
          {
            currentValue: '3.50.0',
            datasource: 'github-releases',
            packageName: 'oracle/oci-cli',
            depName: 'oci',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '1.2.0',
            datasource: 'github-releases',
            packageName: 'open-policy-agent/opa',
            depName: 'opa',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '1.6.0',
            datasource: 'github-releases',
            packageName: 'opentofu/opentofu',
            depName: 'opentofu',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '1.11.2',
            datasource: 'github-releases',
            packageName: 'hashicorp/packer',
            depName: 'packer',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '5.37.5',
            datasource: 'github-tags',
            packageName: 'Perl/perl5',
            depName: 'perl',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '8.1.12',
            datasource: 'github-tags',
            packageName: 'php/php-src',
            depName: 'php',
            extractVersion: '^php-(?<version>\\S+)',
          },
          {
            currentValue: '7.26.2',
            datasource: 'npm',
            packageName: 'pnpm',
            depName: 'pnpm',
            versioning: 'semver',
          },
          {
            currentValue: '1.3.2',
            datasource: 'pypi',
            packageName: 'poetry',
            depName: 'poetry',
          },
          {
            currentValue: '3.3.1',
            datasource: 'github-tags',
            packageName: 'pre-commit/pre-commit',
            depName: 'pre-commit',
            extractVersion: '^v(?<version>.+)',
          },
          {
            currentValue: '28.3',
            datasource: 'github-releases',
            packageName: 'protocolbuffers/protobuf',
            depName: 'protoc',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '3.57.1',
            datasource: 'github-releases',
            packageName: 'pulumi/pulumi',
            depName: 'pulumi',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '3.11.0',
            datasource: 'github-tags',
            packageName: 'python/cpython',
            depName: 'python',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '3.23.0',
            datasource: 'github-tags',
            packageName: 'erlang/rebar3',
            depName: 'rebar',
          },
          {
            currentValue: '3.1.2',
            datasource: 'ruby-version',
            packageName: 'ruby-version',
            versioning: 'semver',
            depName: 'ruby',
          },
          {
            currentValue: '1.64.0',
            datasource: 'github-tags',
            packageName: 'rust-lang/rust',
            depName: 'rust',
          },
          {
            currentValue: '1.9.7',
            datasource: 'github-releases',
            packageName: 'sbt/sbt',
            depName: 'sbt',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '3.2.1',
            datasource: 'github-tags',
            packageName: 'lampepfl/dotty',
            depName: 'scala',
          },
          {
            currentValue: '0.8.0',
            datasource: 'github-releases',
            packageName: 'koalaman/shellcheck',
            depName: 'shellcheck',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '3.5.1',
            datasource: 'github-releases',
            packageName: 'mvdan/sh',
            depName: 'shfmt',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '2.14.0',
            datasource: 'github-releases',
            packageName: 'GoogleContainerTools/skaffold',
            depName: 'skaffold',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '3.0.18',
            datasource: 'github-tags',
            packageName: 'budimanjojo/talhelper',
            depName: 'talhelper',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '1.9.3',
            datasource: 'github-tags',
            packageName: 'siderolabs/talos',
            depName: 'talosctl',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '1.3.3',
            datasource: 'github-releases',
            packageName: 'hashicorp/terraform',
            depName: 'terraform',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '0.16.0',
            datasource: 'github-tags',
            packageName: 'terraform-docs/terraform-docs',
            depName: 'terraform-docs',
            extractVersion: '^v(?<version>.+)',
          },
          {
            currentValue: '0.8.21',
            datasource: 'github-releases',
            packageName: 'GoogleCloudPlatform/terraformer',
            depName: 'terraformer',
          },
          {
            currentValue: '0.43.2',
            datasource: 'github-releases',
            packageName: 'gruntwork-io/terragrunt',
            depName: 'terragrunt',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '0.12.1',
            datasource: 'github-releases',
            packageName: 'terramate-io/terramate',
            depName: 'terramate',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '0.44.1',
            datasource: 'github-tags',
            packageName: 'terraform-linters/tflint',
            depName: 'tflint',
            extractVersion: '^v(?<version>.+)',
          },
          {
            currentValue: '1.28.1',
            datasource: 'github-tags',
            packageName: 'aquasecurity/tfsec',
            depName: 'tfsec',
            extractVersion: '^v(?<version>.+)',
          },
          {
            currentValue: '0.33.0',
            datasource: 'github-releases',
            packageName: 'aquasecurity/trivy',
            depName: 'trivy',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '1.15.1',
            datasource: 'github-releases',
            packageName: 'hashicorp/vault',
            depName: 'vault',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '1.35.0',
            datasource: 'github-tags',
            packageName: 'adrienverge/yamllint',
            depName: 'yamllint',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '4.40.5',
            datasource: 'github-releases',
            packageName: 'mikefarah/yq',
            depName: 'yq',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '0.9.1',
            datasource: 'github-tags',
            packageName: 'ziglang/zig',
            depName: 'zig',
          },
          {
            currentValue: '1.24.0',
            datasource: 'github-releases',
            packageName: 'mobile-dev-inc/maestro',
            depName: 'maestro',
            extractVersion: '^cli-(?<version>\\S+)',
          },
          {
            currentValue: '1.21.0',
            datasource: 'github-releases',
            packageName: 'detekt/detekt',
            depName: 'detekt',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '0.48.1',
            datasource: 'github-releases',
            packageName: 'pinterest/ktlint',
            depName: 'ktlint',
          },
          {
            currentValue: '0.9.0',
            datasource: 'github-releases',
            packageName: 'google/yamlfmt',
            depName: 'yamlfmt',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '1.16.1',
            datasource: 'github-releases',
            packageName: 'crate-ci/typos',
            depName: 'typos',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '0.20.10',
            datasource: 'github-releases',
            packageName: 'turbot/steampipe',
            depName: 'steampipe',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            depName: 'dummy',
            skipReason: 'unsupported-datasource',
          },
        ],
      });
    });

    it('can handle multiple tools with indented versions in one file', () => {
      const res = extractPackageFile(
        codeBlock`
adr-tools 3.0.0
argocd    2.5.4
awscli    2.8.6
`,
      );
      expect(res).toEqual({
        deps: [
          {
            currentValue: '3.0.0',
            datasource: 'github-tags',
            packageName: 'npryce/adr-tools',
            depName: 'adr-tools',
          },
          {
            currentValue: '2.5.4',
            datasource: 'github-releases',
            packageName: 'argoproj/argo-cd',
            depName: 'argocd',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '2.8.6',
            datasource: 'github-tags',
            packageName: 'aws/aws-cli',
            depName: 'awscli',
          },
        ],
      });
    });

    it('can handle flutter version channel', () => {
      const withChannel = extractPackageFile('flutter 3.10.0-stable');
      expect(withChannel).toEqual({
        deps: [
          {
            currentValue: '3.10.0',
            datasource: 'flutter-version',
            depName: 'flutter',
          },
        ],
      });
      const withoutChannel = extractPackageFile('flutter 3.10.0');
      expect(withoutChannel).toEqual({
        deps: [
          {
            currentValue: '3.10.0',
            datasource: 'flutter-version',
            depName: 'flutter',
          },
        ],
      });
    });

    it('can handle java jre / jdk', () => {
      const adoptOpenJdkRes = extractPackageFile('java adoptopenjdk-16.0.0+36');
      expect(adoptOpenJdkRes).toEqual({
        deps: [
          {
            currentValue: '16.0.0+36',
            datasource: 'java-version',
            depName: 'java',
            packageName: 'java-jdk',
          },
        ],
      });
      const adoptOpenJreRes = extractPackageFile(
        'java adoptopenjdk-jre-16.0.0+36',
      );
      expect(adoptOpenJreRes).toEqual({
        deps: [
          {
            currentValue: '16.0.0+36',
            datasource: 'java-version',
            depName: 'java',
            packageName: 'java-jre',
          },
        ],
      });
      const temurinJdkRes = extractPackageFile('java temurin-16.0.0+36');
      expect(temurinJdkRes).toEqual({
        deps: [
          {
            currentValue: '16.0.0+36',
            datasource: 'java-version',
            depName: 'java',
            packageName: 'java-jdk',
          },
        ],
      });
      const temurinJreRes = extractPackageFile('java temurin-jre-16.0.0+36');
      expect(temurinJreRes).toEqual({
        deps: [
          {
            currentValue: '16.0.0+36',
            datasource: 'java-version',
            depName: 'java',
            packageName: 'java-jre',
          },
        ],
      });
      const unknownRes = extractPackageFile('java unknown-16.0.0+36');
      expect(unknownRes).toEqual({
        deps: [
          {
            depName: 'java',
            skipReason: 'unsupported-datasource',
          },
        ],
      });
    });

    it('can handle scala v 2 & 3', () => {
      const v2Res = extractPackageFile('scala 2.0.0');
      expect(v2Res).toEqual({
        deps: [
          {
            currentValue: '2.0.0',
            datasource: 'github-tags',
            depName: 'scala',
            packageName: 'scala/scala',
            extractVersion: '^v(?<version>\\S+)',
          },
        ],
      });
      const v3Res = extractPackageFile('scala 3.0.0');
      expect(v3Res).toEqual({
        deps: [
          {
            currentValue: '3.0.0',
            datasource: 'github-tags',
            depName: 'scala',
            packageName: 'lampepfl/dotty',
          },
        ],
      });
      const unknownRes = extractPackageFile('scala 0.0.0');
      expect(unknownRes).toEqual({
        deps: [
          {
            depName: 'scala',
            skipReason: 'unsupported-datasource',
          },
        ],
      });
    });

    describe('comment handling', () => {
      const validComments = [
        {
          entry: 'nodejs 16.16.0 # tidy comment',
          expect: '16.16.0',
        },
        {
          entry: 'nodejs 16.16.0 #sloppy-comment',
          expect: '16.16.0',
        },
      ];

      describe.each(validComments)(
        'ignores proper comments at the end of lines',
        (data) => {
          it(`entry: '${data.entry}'`, () => {
            const res = extractPackageFile(data.entry);
            expect(res).toEqual({
              deps: [
                {
                  currentValue: data.expect,
                  datasource: 'node-version',
                  depName: 'node',
                },
              ],
            });
          });
        },
      );

      it('invalid comment placements fail to parse', () => {
        const res = extractPackageFile(
          'nodejs 16.16.0# invalid comment spacing',
        );
        expect(res).toBeNull();
      });

      it('ignores lines that are just comments', () => {
        const res = extractPackageFile('# this is a full line comment\n');
        expect(res).toBeNull();
      });

      it('ignores comments across multiple lines', () => {
        const res = extractPackageFile(
          '# this is a full line comment\nnodejs 16.16.0 # this is a comment\n',
        );
        expect(res).toEqual({
          deps: [
            {
              currentValue: '16.16.0',
              datasource: 'node-version',
              depName: 'node',
            },
          ],
        });
      });

      it('ignores supported tooling with a renovate:ignore comment', () => {
        const res = extractPackageFile('nodejs 16.16.0 # renovate:ignore\n');
        expect(res).toEqual({
          deps: [
            {
              currentValue: '16.16.0',
              datasource: 'node-version',
              depName: 'node',
              skipReason: 'ignored',
            },
          ],
        });
      });
    });
  });
});
