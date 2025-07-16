import { codeBlock } from 'common-tags';
import { extractPackageFile } from '.';
import { Fixtures } from '~test/fixtures';

vi.mock('../../../util/fs');

const miseFilename = 'mise.toml';

const mise1toml = Fixtures.get('Mise.1.toml');

describe('modules/manager/mise/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('', miseFilename)).toBeNull();
    });

    it('returns null for invalid TOML', () => {
      expect(extractPackageFile('foo', miseFilename)).toBeNull();
    });

    it('returns null for empty tools section', () => {
      const content = codeBlock`
      [tools]
    `;
      expect(extractPackageFile(content, miseFilename)).toBeNull();
    });

    it('extracts tools - mise core plugins', () => {
      const content = codeBlock`
      [tools]
      erlang = '23.3'
      node = '16'
    `;
      const result = extractPackageFile(content, miseFilename);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'erlang',
            currentValue: '23.3',
            datasource: 'github-tags',
          },
          {
            depName: 'node',
            currentValue: '16',
            datasource: 'node-version',
          },
        ],
      });
    });

    it('extracts tools - mise registry tools', () => {
      const content = codeBlock`
      [tools]
      actionlint = "1.7.7"
      astro = "1.34.0"
      aws-cli = "2.25.10"
      aws-vault = "6.6.1"
      buf = "1.27.0"
      ccache = "4.11.3"
      committed = "1.1.7"
      consul = "1.14.3"
      dotenv-linter = "3.3.0"
      hivemind = "1.1.0"
      hk = "1.1.2"
      jq = "1.7.1"
      kafka = "apache-3.9.0"
      lefthook = "1.11.13"
      localstack = "4.3.0"
      lychee = "0.19.1"
      opentofu = "1.6.1"
      pipx = "1.7.1"
      pkl = "0.28.2"
      protoc = "30.2"
      redis = "8.0.1"
      ruff = "0.11.12"
      shellcheck = "0.10.0"
      skeema = "1.12.3"
      sops = "3.10.2"
      sqlite = "3.50.1"
      stripe = "1.25.0"
      taplo = "0.10.0"
      terragrunt = "0.72.6"
      tilt = "0.34.0"
      tusd = "2.8.0"
      usage = "2.1.1"
    `;
      const result = extractPackageFile(content, miseFilename);
      expect(result).toMatchObject({
        deps: [
          {
            currentValue: '1.7.7',
            datasource: 'github-releases',
            depName: 'actionlint',
            extractVersion: '^v(?<version>\\S+)',
            packageName: 'rhysd/actionlint',
          },
          {
            currentValue: '1.34.0',
            datasource: 'github-releases',
            depName: 'astro',
            extractVersion: '^v(?<version>\\S+)',
            packageName: 'astronomer/astro-cli',
          },
          {
            currentValue: '2.25.10',
            datasource: 'github-tags',
            depName: 'aws-cli',
            packageName: 'aws/aws-cli',
          },
          {
            currentValue: '6.6.1',
            datasource: 'github-releases',
            depName: 'aws-vault',
            extractVersion: '^v(?<version>\\S+)',
            packageName: '99designs/aws-vault',
          },
          {
            currentValue: '1.27.0',
            datasource: 'github-releases',
            depName: 'buf',
            extractVersion: '^v(?<version>\\S+)',
            packageName: 'bufbuild/buf',
          },
          {
            currentValue: '4.11.3',
            datasource: 'github-releases',
            depName: 'ccache',
            extractVersion: '^v(?<version>\\S+)',
            packageName: 'ccache/ccache',
          },
          {
            currentValue: '1.1.7',
            datasource: 'github-releases',
            depName: 'committed',
            extractVersion: '^v(?<version>\\S+)',
            packageName: 'crate-ci/committed',
          },
          {
            currentValue: '1.14.3',
            datasource: 'github-releases',
            depName: 'consul',
            extractVersion: '^v(?<version>\\S+)',
            packageName: 'hashicorp/consul',
          },
          {
            currentValue: '3.3.0',
            datasource: 'github-releases',
            depName: 'dotenv-linter',
            extractVersion: '^v(?<version>\\S+)',
            packageName: 'dotenv-linter/dotenv-linter',
          },
          {
            currentValue: '1.1.0',
            datasource: 'github-releases',
            depName: 'hivemind',
            extractVersion: '^v(?<version>\\S+)',
            packageName: 'DarthSim/hivemind',
          },
          {
            currentValue: '1.1.2',
            datasource: 'github-releases',
            depName: 'hk',
            extractVersion: '^v(?<version>\\S+)',
            packageName: 'jdx/hk',
          },
          {
            currentValue: '1.7.1',
            datasource: 'github-releases',
            depName: 'jq',
            extractVersion: '^jq-v(?<version>\\S+)',
            packageName: 'jqlang/jq',
          },
          {
            currentValue: '3.9.0',
            datasource: 'github-tags',
            depName: 'kafka',
            packageName: 'apache/kafka',
          },
          {
            currentValue: '1.11.13',
            datasource: 'github-releases',
            depName: 'lefthook',
            extractVersion: '^v(?<version>\\S+)',
            packageName: 'evilmartians/lefthook',
          },
          {
            currentValue: '4.3.0',
            datasource: 'github-releases',
            depName: 'localstack',
            extractVersion: '^v(?<version>\\S+)',
            packageName: 'localstack/localstack',
          },
          {
            currentValue: '0.19.1',
            datasource: 'github-releases',
            depName: 'lychee',
            extractVersion: '^lychee-v(?<version>\\S+)',
            packageName: 'lycheeverse/lychee',
          },
          {
            currentValue: '1.6.1',
            datasource: 'github-releases',
            depName: 'opentofu',
            extractVersion: '^v(?<version>\\S+)',
            packageName: 'opentofu/opentofu',
          },
          {
            currentValue: '1.7.1',
            datasource: 'github-releases',
            depName: 'pipx',
            packageName: 'pypa/pipx',
          },
          {
            currentValue: '0.28.2',
            datasource: 'github-releases',
            depName: 'pkl',
            packageName: 'apple/pkl',
          },
          {
            currentValue: '30.2',
            datasource: 'github-releases',
            depName: 'protoc',
            extractVersion: '^v(?<version>\\S+)',
            packageName: 'protocolbuffers/protobuf',
          },
          {
            currentValue: '8.0.1',
            datasource: 'github-releases',
            depName: 'redis',
            packageName: 'redis/redis',
          },
          {
            currentValue: '0.11.12',
            datasource: 'github-releases',
            depName: 'ruff',
            packageName: 'astral-sh/ruff',
          },
          {
            currentValue: '0.10.0',
            datasource: 'github-releases',
            depName: 'shellcheck',
            extractVersion: '^v(?<version>\\S+)',
            packageName: 'koalaman/shellcheck',
          },
          {
            currentValue: '1.12.3',
            datasource: 'github-releases',
            depName: 'skeema',
            extractVersion: '^v(?<version>\\S+)',
            packageName: 'skeema/skeema',
          },
          {
            currentValue: '3.10.2',
            datasource: 'github-releases',
            depName: 'sops',
            extractVersion: '^v(?<version>\\S+)',
            packageName: 'getsops/sops',
          },
          {
            currentValue: '3.50.1',
            datasource: 'github-tags',
            depName: 'sqlite',
            extractVersion: '^version-(?<version>\\S+)',
            packageName: 'sqlite/sqlite',
          },
          {
            currentValue: '1.25.0',
            datasource: 'github-releases',
            depName: 'stripe',
            extractVersion: '^v(?<version>\\S+)',
            packageName: 'stripe/stripe-cli',
          },
          {
            currentValue: '0.10.0',
            datasource: 'github-releases',
            depName: 'taplo',
            packageName: 'tamasfe/taplo',
          },
          {
            currentValue: '0.72.6',
            datasource: 'github-releases',
            depName: 'terragrunt',
            extractVersion: '^v(?<version>\\S+)',
            packageName: 'gruntwork-io/terragrunt',
          },
          {
            currentValue: '0.34.0',
            datasource: 'github-releases',
            depName: 'tilt',
            extractVersion: '^v(?<version>\\S+)',
            packageName: 'tilt-dev/tilt',
          },
          {
            currentValue: '2.8.0',
            datasource: 'github-releases',
            depName: 'tusd',
            extractVersion: '^v(?<version>\\S+)',
            packageName: 'tus/tusd',
          },
          {
            currentValue: '2.1.1',
            datasource: 'github-releases',
            depName: 'usage',
            extractVersion: '^v(?<version>\\S+)',
            packageName: 'jdx/usage',
          },
        ],
      });
    });

    it('extracts tools - asdf plugins', () => {
      const content = codeBlock`
      [tools]
      terraform = '1.8.0'
    `;
      const result = extractPackageFile(content, miseFilename);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'terraform',
            currentValue: '1.8.0',
          },
        ],
      });
    });

    it('extracts tools with multiple versions', () => {
      const content = codeBlock`
      [tools]
      erlang = ['23.3', '24.0']
      node = ['16', 'prefix:20', 'ref:master', 'path:~/.nodes/14']
    `;
      const result = extractPackageFile(content, miseFilename);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'erlang',
            currentValue: '23.3',
            datasource: 'github-tags',
          },
          {
            depName: 'node',
            currentValue: '16',
            datasource: 'node-version',
          },
        ],
      });
    });

    it('extracts tools with plugin options', () => {
      const content = codeBlock`
      [tools]
      python = {version='3.11', virtualenv='.venv'}
    `;
      const result = extractPackageFile(content, miseFilename);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'python',
            currentValue: '3.11',
          },
        ],
      });
    });

    it('extracts tools in the default registry with backends', () => {
      const content = codeBlock`
      [tools]
      "core:node" = "16"
      "asdf:rust" = "1.82.0"
      "vfox:scala" = "3.5.2"
      "aqua:act" = "0.2.70"
    `;
      const result = extractPackageFile(content, miseFilename);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'core:node',
            currentValue: '16',
            packageName: 'nodejs',
            datasource: 'node-version',
          },
          {
            depName: 'asdf:rust',
            currentValue: '1.82.0',
            packageName: 'rust-lang/rust',
            datasource: 'github-tags',
          },
          {
            depName: 'vfox:scala',
            currentValue: '3.5.2',
            packageName: 'lampepfl/dotty',
            datasource: 'github-tags',
          },
          {
            depName: 'aqua:act',
            currentValue: '0.2.70',
            packageName: 'nektos/act',
            datasource: 'github-releases',
          },
        ],
      });
    });

    it('extracts aqua backend tool', () => {
      const content = codeBlock`
      [tools]
      "aqua:BurntSushi/ripgrep" = "14.1.0"
      "aqua:cli/cli" = "v2.64.0"
    `;
      const result = extractPackageFile(content, miseFilename);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'aqua:BurntSushi/ripgrep',
            currentValue: '14.1.0',
            packageName: 'BurntSushi/ripgrep',
            datasource: 'github-tags',
            extractVersion: '^v?(?<version>.+)',
          },
          {
            depName: 'aqua:cli/cli',
            currentValue: '2.64.0',
            packageName: 'cli/cli',
            datasource: 'github-tags',
            extractVersion: '^v?(?<version>.+)',
          },
        ],
      });
    });

    it('extracts cargo backend tools', () => {
      const content = codeBlock`
      [tools]
      "cargo:eza" = "0.18.21"
      "cargo:https://github.com/username/demo1" = "tag:v0.1.0"
      "cargo:https://github.com/username/demo2" = "branch:main"
      "cargo:https://github.com/username/demo3" = "rev:abcdef"
    `;
      const result = extractPackageFile(content, miseFilename);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'cargo:eza',
            currentValue: '0.18.21',
            packageName: 'eza',
            datasource: 'crate',
          },
          {
            depName: 'cargo:https://github.com/username/demo1',
            currentValue: 'v0.1.0',
            packageName: 'https://github.com/username/demo1',
            datasource: 'git-tags',
          },
          {
            depName: 'cargo:https://github.com/username/demo2',
            currentValue: 'main',
            packageName: 'https://github.com/username/demo2',
            datasource: 'git-refs',
          },
          {
            depName: 'cargo:https://github.com/username/demo3',
            currentValue: 'abcdef',
            packageName: 'https://github.com/username/demo3',
            datasource: 'git-refs',
          },
        ],
      });
    });

    it('extracts dotnet backend tool', () => {
      const content = codeBlock`
      [tools]
      "dotnet:GitVersion.Tool" = "5.12.0"
    `;
      const result = extractPackageFile(content, miseFilename);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'dotnet:GitVersion.Tool',
            currentValue: '5.12.0',
            packageName: 'GitVersion.Tool',
            datasource: 'nuget',
          },
        ],
      });
    });

    it('extracts gem backend tool', () => {
      const content = codeBlock`
      [tools]
      "gem:rubocop" = "1.69.2"
    `;
      const result = extractPackageFile(content, miseFilename);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'gem:rubocop',
            currentValue: '1.69.2',
            packageName: 'rubocop',
            datasource: 'rubygems',
          },
        ],
      });
    });

    it('extracts go backend tool', () => {
      const content = codeBlock`
      [tools]
      "go:github.com/DarthSim/hivemind" = "1.0.6"
    `;
      const result = extractPackageFile(content, miseFilename);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'go:github.com/DarthSim/hivemind',
            currentValue: '1.0.6',
            packageName: 'github.com/DarthSim/hivemind',
            datasource: 'go',
          },
        ],
      });
    });

    it('extracts npm backend tool', () => {
      const content = codeBlock`
      [tools]
      "npm:prettier" = "3.3.2"
    `;
      const result = extractPackageFile(content, miseFilename);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'npm:prettier',
            currentValue: '3.3.2',
            packageName: 'prettier',
            datasource: 'npm',
          },
        ],
      });
    });

    it('extracts pipx backend tools', () => {
      const content = codeBlock`
      [tools]
      "pipx:yamllint" = "1.35.0"
      "pipx:psf/black" = "24.4.1"
      "pipx:git+https://github.com/psf/black.git" = "24.4.1"
    `;
      const result = extractPackageFile(content, miseFilename);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'pipx:yamllint',
            currentValue: '1.35.0',
            packageName: 'yamllint',
            datasource: 'pypi',
          },
          {
            depName: 'pipx:psf/black',
            currentValue: '24.4.1',
            packageName: 'psf/black',
            datasource: 'github-tags',
          },
          {
            depName: 'pipx:git+https://github.com/psf/black.git',
            currentValue: '24.4.1',
            packageName: 'psf/black',
            datasource: 'github-tags',
          },
        ],
      });
    });

    it('extracts spm backend tools', () => {
      const content = codeBlock`
      [tools]
      "spm:tuist/tuist" = "4.15.0"
      "spm:https://github.com/tuist/tuist.git" = "4.13.0"
    `;
      const result = extractPackageFile(content, miseFilename);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'spm:tuist/tuist',
            currentValue: '4.15.0',
            packageName: 'tuist/tuist',
            datasource: 'github-releases',
          },
          {
            depName: 'spm:https://github.com/tuist/tuist.git',
            currentValue: '4.13.0',
            packageName: 'tuist/tuist',
            datasource: 'github-releases',
          },
        ],
      });
    });

    it('extracts ubi backend tools', () => {
      const content = codeBlock`
      [tools]
      "ubi:nekto/act" = "v0.2.70"
      "ubi:cli/cli" = { exe = "gh", version = "1.14.0" }
      "ubi:cli/cli[exe=gh]" = "1.14.0"
      "ubi:cargo-bins/cargo-binstall" = { tag_regex = "^\\\\d+\\\\.\\\\d+\\\\.", version = "1.0.0" }
      "ubi:cargo-bins/cargo-binstall[tag_regex=^\\\\d+\\\\.]" = "1.0.0"
      'ubi:cargo-bins/cargo-binstall[tag_regex=^\\d+\\.\\d+\\.]' = { tag_regex = '^\\d+\\.', version = "1.0.0" }
    `;
      const result = extractPackageFile(content, miseFilename);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'ubi:nekto/act',
            currentValue: 'v0.2.70',
            packageName: 'nekto/act',
            datasource: 'github-releases',
          },
          {
            depName: 'ubi:cli/cli',
            currentValue: '1.14.0',
            packageName: 'cli/cli',
            datasource: 'github-releases',
            extractVersion: '^v?(?<version>.+)',
          },
          {
            depName: 'ubi:cli/cli',
            currentValue: '1.14.0',
            packageName: 'cli/cli',
            datasource: 'github-releases',
            extractVersion: '^v?(?<version>.+)',
          },
          {
            depName: 'ubi:cargo-bins/cargo-binstall',
            currentValue: '1.0.0',
            packageName: 'cargo-bins/cargo-binstall',
            datasource: 'github-releases',
            extractVersion: '^v?(?<version>\\d+\\.\\d+\\.)',
          },
          {
            depName: 'ubi:cargo-bins/cargo-binstall',
            currentValue: '1.0.0',
            packageName: 'cargo-bins/cargo-binstall',
            datasource: 'github-releases',
            extractVersion: '^v?(?<version>\\d+\\.)',
          },
          {
            depName: 'ubi:cargo-bins/cargo-binstall',
            currentValue: '1.0.0',
            packageName: 'cargo-bins/cargo-binstall',
            datasource: 'github-releases',
            extractVersion: '^v?(?<version>\\d+\\.)',
          },
        ],
      });
    });

    it('provides skipReason for lines with unsupported tooling', () => {
      const content = codeBlock`
      [tools]
      fake-tool = '1.0.0'
      'fake:tool' = '1.0.0'
    `;
      const result = extractPackageFile(content, miseFilename);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'fake-tool',
            skipReason: 'unsupported-datasource',
          },
          {
            depName: 'fake:tool',
            skipReason: 'unsupported-datasource',
          },
        ],
      });
    });

    it('provides skipReason for missing version - empty string', () => {
      const content = codeBlock`
      [tools]
      python = ''
    `;
      const result = extractPackageFile(content, miseFilename);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'python',
            skipReason: 'unspecified-version',
          },
        ],
      });
    });

    it('provides skipReason for missing version - missing version in object', () => {
      const content = codeBlock`
      [tools]
      python = {virtualenv='.venv'}
    `;
      const result = extractPackageFile(content, miseFilename);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'python',
            skipReason: 'unspecified-version',
          },
        ],
      });
    });

    it('provides skipReason for missing version - empty array', () => {
      const content = codeBlock`
      [tools]
      java = '21.0.2'
      erlang = []
    `;
      const result = extractPackageFile(content, miseFilename);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'java',
            currentValue: '21.0.2',
          },
          {
            depName: 'erlang',
            skipReason: 'unspecified-version',
          },
        ],
      });
    });

    it('complete mise.toml example', () => {
      const result = extractPackageFile(mise1toml, miseFilename);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'java',
            currentValue: '21.0.2',
            datasource: 'java-version',
          },
          {
            depName: 'erlang',
            currentValue: '23.3',
            datasource: 'github-tags',
          },
          {
            depName: 'node',
            currentValue: '16',
            datasource: 'node-version',
          },
        ],
      });
    });

    it('complete example with skip', () => {
      const content = codeBlock`
      [tools]
      java = '21.0.2'
      erlang = ['23.3', '24.0']
      terraform = {version='1.8.0'}
      fake-tool = '1.6.2'
    `;
      const result = extractPackageFile(content, miseFilename);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'java',
            currentValue: '21.0.2',
            datasource: 'java-version',
          },
          {
            depName: 'erlang',
            currentValue: '23.3',
            datasource: 'github-tags',
          },
          {
            depName: 'terraform',
            currentValue: '1.8.0',
          },
          {
            depName: 'fake-tool',
            skipReason: 'unsupported-datasource',
          },
        ],
      });
    });

    it('core java plugin function', () => {
      const content = codeBlock`
      [tools]
      java = "21.0.2"
    `;
      const result = extractPackageFile(content, miseFilename);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'java',
            currentValue: '21.0.2',
            datasource: 'java-version',
          },
        ],
      });

      const content2 = codeBlock`
      [tools]
      java = "openjdk-21.0.2"
    `;
      const result2 = extractPackageFile(content2, miseFilename);
      expect(result2).toMatchObject({
        deps: [
          {
            depName: 'java',
            currentValue: '21.0.2',
            datasource: 'java-version',
          },
        ],
      });

      const content3 = codeBlock`
      [tools]
      java = "temurin-21.0.2"
    `;
      const result3 = extractPackageFile(content3, miseFilename);
      expect(result3).toMatchObject({
        deps: [
          {
            depName: 'java',
            currentValue: '21.0.2',
            datasource: 'java-version',
          },
        ],
      });

      const content4 = codeBlock`
      [tools]
      java = "zulu-21.0.2"
    `;
      const result4 = extractPackageFile(content4, miseFilename);
      expect(result4).toMatchObject({
        deps: [
          {
            depName: 'java',
            currentValue: '21.0.2',
            datasource: 'java-version',
          },
        ],
      });

      const content5 = codeBlock`
      [tools]
      java = "corretto-21.0.2"
    `;
      const result5 = extractPackageFile(content5, miseFilename);
      expect(result5).toMatchObject({
        deps: [
          {
            depName: 'java',
            currentValue: '21.0.2',
            datasource: 'java-version',
          },
        ],
      });

      const content6 = codeBlock`
      [tools]
      java = "oracle-graalvm-21.0.2"
    `;
      const result6 = extractPackageFile(content6, miseFilename);
      expect(result6).toMatchObject({
        deps: [
          {
            depName: 'java',
            currentValue: '21.0.2',
            datasource: 'java-version',
          },
        ],
      });

      const content7 = codeBlock`
      [tools]
      java = "adoptopenjdk-21.0.2"
    `;
      const result7 = extractPackageFile(content7, miseFilename);
      expect(result7).toMatchObject({
        deps: [
          {
            depName: 'java',
            currentValue: '21.0.2',
            datasource: 'java-version',
          },
        ],
      });

      // Test that fallback to asdf Plugin works
      const content8 = codeBlock`
      [tools]
      java = "adoptopenjdk-jre-16.0.0+36"
    `;
      const result8 = extractPackageFile(content8, miseFilename);
      expect(result8).toMatchObject({
        deps: [
          {
            depName: 'java',
            currentValue: '16.0.0+36',
            datasource: 'java-version',
          },
        ],
      });
    });
  });
});
