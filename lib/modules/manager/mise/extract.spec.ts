import { codeBlock } from 'common-tags';
import { extractPackageFile } from '.';
import { Fixtures } from '~test/fixtures';

vi.mock('../../../util/fs');

const miseFilename = '.mise.toml';

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
      aws-cli = "2.25.10"
      aws-vault = "6.6.1"
      buf = "1.27.0"
      consul = "1.14.3"
      hivemind = "1.1.0"
      jq = "1.7.1"
      kafka = "apache-3.9.0"
      localstack = "4.3.0"
      opentofu = "1.6.1"
      protoc = "30.2"
      shellcheck = "0.10.0"
      skeema = "1.12.3"
      sops = "3.10.2"
      stripe = "1.25.0"
      terragrunt = "0.72.6"
      tilt = "0.34.0"
      tusd = "2.8.0"
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
            currentValue: '1.14.3',
            datasource: 'github-releases',
            depName: 'consul',
            extractVersion: '^v(?<version>\\S+)',
            packageName: 'hashicorp/consul',
          },
          {
            currentValue: '1.1.0',
            datasource: 'github-releases',
            depName: 'hivemind',
            extractVersion: '^v(?<version>\\S+)',
            packageName: 'DarthSim/hivemind',
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
            currentValue: '4.3.0',
            datasource: 'github-releases',
            depName: 'localstack',
            extractVersion: '^v(?<version>\\S+)',
            packageName: 'localstack/localstack',
          },
          {
            currentValue: '1.6.1',
            datasource: 'github-releases',
            depName: 'opentofu',
            extractVersion: '^v(?<version>\\S+)',
            packageName: 'opentofu/opentofu',
          },
          {
            currentValue: '30.2',
            datasource: 'github-releases',
            depName: 'protoc',
            extractVersion: '^v(?<version>\\S+)',
            packageName: 'protocolbuffers/protobuf',
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
            currentValue: '1.25.0',
            datasource: 'github-releases',
            depName: 'stripe',
            extractVersion: '^v(?<version>\\S+)',
            packageName: 'stripe/stripe-cli',
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

    it('provides skipReason for lines with unsupported tooling', () => {
      const content = codeBlock`
      [tools]
      fake-tool = '1.0.0'
    `;
      const result = extractPackageFile(content, miseFilename);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'fake-tool',
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

    it('complete .mise.toml example', () => {
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
