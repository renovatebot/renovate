import { codeBlock } from 'common-tags';
import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

jest.mock('../../../util/fs');

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
