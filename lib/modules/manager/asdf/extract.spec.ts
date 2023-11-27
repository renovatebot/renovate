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
adr-tools 3.0.0
argocd 2.5.4
asdf-plugin-manager 1.1.1
awscli 2.8.6
bun 0.2.2
cargo-make 0.36.2
checkov 2.3.3
clojure 1.11.1.1182
crystal 1.6.1
dart 2.19.3
deno 1.26.2
direnv 2.32.1
dprint 0.32.2
ecspresso 2.1.0
elixir 1.14.1
elm 0.19.1
erlang 25.1.2
flutter 3.7.6-stable
flux2 0.41.2
gauche 0.9.12
github-cli 2.32.1
gohugo extended_0.104.3
golang 1.19.2
golangci-lint 1.52.2
hadolint 2.12.0
haskell 9.4.2
helm 3.10.1
helmfile 0.147.0
hugo 0.104.3
idris 1.3.4
java adoptopenjdk-16.0.0+36
julia 1.8.2
just 1.7.0
kotlin 1.7.20
kubectl 1.26.3
kustomize 4.5.7
lua 5.4.4
nim 1.6.8
nodejs 18.12.0
ocaml 4.14.0
perl 5.37.5
php 8.1.12
pnpm 7.26.2
poetry 1.3.2
pre-commit 3.3.1
pulumi 3.57.1
python 3.11.0
ruby 3.1.2
rust 1.64.0
sbt 1.9.7
scala 3.2.1
shellcheck 0.8.0
shfmt 3.5.1
terraform 1.3.3
terraform-docs 0.16.0
terragrunt 0.43.2
tflint 0.44.1
tfsec 1.28.1
trivy 0.33.0
vault 1.15.1
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
            currentValue: '2.8.6',
            datasource: 'github-tags',
            packageName: 'aws/aws-cli',
            depName: 'awscli',
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
            currentValue: '0.104.3',
            datasource: 'github-releases',
            packageName: 'gohugoio/hugo',
            depName: 'gohugo',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '1.19.2',
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
            currentValue: '1.7.20',
            datasource: 'github-releases',
            packageName: 'JetBrains/kotlin',
            depName: 'kotlin',
            extractVersion: '^(Kotlin |v)(?<version>\\S+)',
          },
          {
            currentValue: '1.26.3',
            datasource: 'github-tags',
            packageName: 'kubernetes/kubernetes',
            depName: 'kubectl',
            extractVersion: '^v(?<version>.+)',
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
            currentValue: '0.43.2',
            datasource: 'github-releases',
            packageName: 'gruntwork-io/terragrunt',
            depName: 'terragrunt',
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
      const semeruJdkRes = extractPackageFile(
        'java semeru-openj9-17.0.8.1+1_openj9-0.40.0',
      );
      expect(semeruJdkRes).toEqual({
        deps: [
          {
            currentValue: '17.0.8.1+1',
            datasource: 'java-version',
            depName: 'java',
            packageName: 'java-jdk',
          },
        ],
      });
      const semeruJreRes = extractPackageFile(
        'java semeru-jre-openj9-17.0.8.1+1_openj9-0.40.0',
      );
      expect(semeruJreRes).toEqual({
        deps: [
          {
            currentValue: '17.0.8.1+1',
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
