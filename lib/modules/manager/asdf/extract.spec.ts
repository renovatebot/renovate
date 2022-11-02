import { extractPackageFile } from '.';

describe('modules/manager/asdf/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns a result', () => {
      const res = extractPackageFile('nodejs 16.16.0\n');
      expect(res).toEqual({
        deps: [
          {
            currentValue: '16.16.0',
            datasource: 'node',
            depName: 'node',
            versioning: 'node',
            packageName: 'node',
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
            datasource: 'node',
            depName: 'node',
            packageName: 'node',
            versioning: 'node',
          },
        ],
      });
    });

    it('can handle multiple tools in one file', () => {
      const res = extractPackageFile(
        `awscli 2.8.6
bun 0.2.2
cargo-make 0.36.2
clojure 1.11.1.1182
crystal 1.6.1
deno 1.26.2
direnv 2.32.1
dprint 0.32.2
elixir 1.14.1
elm 0.19.1
erlang 25.1.2
gauche 0.9.12
golang 1.19.2
haskell 9.4.2
helm 3.10.1
helmfile 0.147.0
hugo 0.104.3
idris 1.3.4
java adoptopenjdk-16.0.0+36
julia 1.8.2
just 1.7.0
kotlin 1.7.20
kustomize 4.5.7
lua 5.4.4
nim 1.6.8
nodejs 18.12.0
ocaml 4.14.0
perl 5.37.5
php 8.1.12
python 3.11.0
ruby 3.1.2
rust 1.64.0
scala 3.2.1
shellcheck 0.8.0
shfmt 3.5.1
terraform 1.3.3
trivy 0.33.0
zig 0.9.1
dummy 1.2.3
`
      );
      expect(res).toEqual({
        deps: [
          {
            currentValue: '2.8.6',
            datasource: 'github-tags',
            packageName: 'aws/aws-cli',
            versioning: 'semver',
            depName: 'awscli',
          },
          {
            currentValue: '0.2.2',
            datasource: 'github-releases',
            packageName: 'oven-sh/bun',
            versioning: 'semver',
            depName: 'bun',
            extractVersion: '^bun-v(?<version>\\S+)',
          },
          {
            currentValue: '0.36.2',
            datasource: 'github-releases',
            packageName: 'sagiegurari/cargo-make',
            versioning: 'semver',
            depName: 'cargo-make',
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
            datasource: 'github-tags',
            packageName: 'crystal-lang/crystal',
            versioning: 'semver',
            depName: 'crystal',
          },
          {
            currentValue: '1.26.2',
            datasource: 'github-releases',
            packageName: 'denoland/deno',
            versioning: 'semver',
            depName: 'deno',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '2.32.1',
            datasource: 'github-releases',
            packageName: 'direnv/direnv',
            versioning: 'semver',
            depName: 'direnv',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '0.32.2',
            datasource: 'github-releases',
            packageName: 'dprint/dprint',
            versioning: 'semver',
            depName: 'dprint',
          },
          {
            currentValue: '1.14.1',
            datasource: 'github-tags',
            packageName: 'elixir-lang/elixir',
            versioning: 'semver',
            depName: 'elixir',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '0.19.1',
            datasource: 'github-releases',
            packageName: 'elm/compiler',
            versioning: 'semver',
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
            currentValue: '0.9.12',
            datasource: 'docker',
            packageName: 'practicalscheme/gauche',
            versioning: 'semver',
            depName: 'gauche',
          },
          {
            currentValue: '1.19.2',
            datasource: 'github-tags',
            packageName: 'golang/go',
            versioning: 'semver',
            depName: 'golang',
            extractVersion: '^go(?<version>\\S+)',
          },
          {
            currentValue: '9.4.2',
            datasource: 'github-tags',
            packageName: 'ghc/ghc',
            versioning: 'semver',
            depName: 'haskell',
            extractVersion: '^ghc-(?<version>\\S+?)-release',
          },
          {
            currentValue: '3.10.1',
            datasource: 'github-releases',
            packageName: 'helm/helm',
            versioning: 'semver',
            depName: 'helm',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '0.147.0',
            datasource: 'github-releases',
            packageName: 'helmfile/helmfile',
            versioning: 'semver',
            depName: 'helmfile',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '0.104.3',
            datasource: 'github-releases',
            packageName: 'gohugoio/hugo',
            versioning: 'semver',
            depName: 'hugo',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '1.3.4',
            datasource: 'github-tags',
            packageName: 'idris-lang/Idris-dev',
            versioning: 'semver',
            depName: 'idris',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '16.0.0+36',
            datasource: 'adoptium-java',
            packageName: 'java-jdk',
            versioning: 'semver',
            depName: 'java',
          },
          {
            currentValue: '1.8.2',
            datasource: 'github-releases',
            packageName: 'JuliaLang/julia',
            versioning: 'semver',
            depName: 'julia',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '1.7.0',
            datasource: 'github-releases',
            packageName: 'casey/just',
            versioning: 'semver',
            depName: 'just',
          },
          {
            currentValue: '1.7.20',
            datasource: 'github-releases',
            packageName: 'JetBrains/kotlin',
            versioning: 'semver',
            depName: 'kotlin',
            extractVersion: '^(Kotlin |v)(?<version>\\S+)',
          },
          {
            currentValue: '4.5.7',
            datasource: 'github-releases',
            packageName: 'kubernetes-sigs/kustomize',
            versioning: 'semver',
            depName: 'kustomize',
            extractVersion: '^kustomize/v(?<version>\\S+)',
          },
          {
            currentValue: '5.4.4',
            datasource: 'github-releases',
            packageName: 'lua/lua',
            versioning: 'semver',
            depName: 'lua',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '1.6.8',
            datasource: 'github-tags',
            packageName: 'nim-lang/Nim',
            versioning: 'semver',
            depName: 'nim',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '18.12.0',
            datasource: 'node',
            packageName: 'node',
            versioning: 'node',
            depName: 'node',
          },
          {
            currentValue: '4.14.0',
            datasource: 'github-releases',
            packageName: 'ocaml/ocaml',
            versioning: 'semver',
            depName: 'ocaml',
          },
          {
            currentValue: '5.37.5',
            datasource: 'github-tags',
            packageName: 'Perl/perl5',
            versioning: 'semver',
            depName: 'perl',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '8.1.12',
            datasource: 'github-tags',
            packageName: 'php/php-src',
            versioning: 'semver',
            depName: 'php',
            extractVersion: '^php-(?<version>\\S+)',
          },
          {
            currentValue: '3.11.0',
            datasource: 'github-tags',
            packageName: 'python/cpython',
            versioning: 'semver',
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
            versioning: 'semver',
            depName: 'rust',
          },
          {
            currentValue: '3.2.1',
            datasource: 'github-tags',
            packageName: 'lampepfl/dotty',
            versioning: 'semver',
            depName: 'scala',
          },
          {
            currentValue: '0.8.0',
            datasource: 'github-releases',
            packageName: 'koalaman/shellcheck',
            versioning: 'semver',
            depName: 'shellcheck',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '3.5.1',
            datasource: 'github-releases',
            packageName: 'mvdan/sh',
            versioning: 'semver',
            depName: 'shfmt',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '1.3.3',
            datasource: 'github-releases',
            packageName: 'hashicorp/terraform',
            versioning: 'semver',
            depName: 'terraform',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '0.33.0',
            datasource: 'github-releases',
            packageName: 'aquasecurity/trivy',
            versioning: 'semver',
            depName: 'trivy',
            extractVersion: '^v(?<version>\\S+)',
          },
          {
            currentValue: '0.9.1',
            datasource: 'github-tags',
            packageName: 'ziglang/zig',
            versioning: 'semver',
            depName: 'zig',
          },
          {
            depName: 'dummy',
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
                  datasource: 'node',
                  depName: 'node',
                  packageName: 'node',
                  versioning: 'node',
                },
              ],
            });
          });
        }
      );

      it('invalid comment placements fail to parse', () => {
        const res = extractPackageFile(
          'nodejs 16.16.0# invalid comment spacing'
        );
        expect(res).toBeNull();
      });

      it('ignores lines that are just comments', () => {
        const res = extractPackageFile('# this is a full line comment\n');
        expect(res).toBeNull();
      });

      it('ignores comments across multiple lines', () => {
        const res = extractPackageFile(
          '# this is a full line comment\nnodejs 16.16.0 # this is a comment\n'
        );
        expect(res).toEqual({
          deps: [
            {
              currentValue: '16.16.0',
              datasource: 'node',
              depName: 'node',
              packageName: 'node',
              versioning: 'node',
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
              datasource: 'node',
              depName: 'node',
              packageName: 'node',
              versioning: 'node',
              skipReason: 'ignored',
            },
          ],
        });
      });
    });
  });
});
