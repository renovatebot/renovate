import { codeBlock } from 'common-tags';
import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

jest.mock('../../../util/fs');

const mise1toml = Fixtures.get('Mise.1.toml');
const mise2toml = Fixtures.get('Mise.2.toml');
const mise3toml = Fixtures.get('Mise.3.toml');
const mise4toml = Fixtures.get('Mise.4.toml');
const mise5toml = Fixtures.get('Mise.5.toml');
const mise6toml = Fixtures.get('Mise.6.toml');

describe('modules/manager/mise/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('')).toBeNull();
    });

    it('returns null for invalid TOML', () => {
      expect(extractPackageFile('foo')).toBeNull();
    });

    it('extracts tools - mise core plugins', () => {
      const result = extractPackageFile(mise1toml);
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
      const result = extractPackageFile(mise2toml);
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
      const result = extractPackageFile(mise3toml);
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
      const result = extractPackageFile(mise6toml);
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
      const result = extractPackageFile(mise4toml);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'fake-tool',
            skipReason: 'unsupported-datasource',
          },
        ],
      });
    });

    it('complete .mise.toml example', () => {
      const result = extractPackageFile(mise5toml);
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

    it('core java plugin function', () => {
      const content = codeBlock`
      [tools]
      java = "21.0.2"
    `;
      const result = extractPackageFile(content);
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
      const result2 = extractPackageFile(content2);
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
      const result3 = extractPackageFile(content3);
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
      const result4 = extractPackageFile(content4);
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
      const result5 = extractPackageFile(content5);
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
      const result6 = extractPackageFile(content6);
      expect(result6).toMatchObject({
        deps: [
          {
            depName: 'java',
            currentValue: '21.0.2',
            datasource: 'java-version',
          },
        ],
      });

      // Test that fallback to asdf Plugin works
      const content7 = codeBlock`
      [tools]
      java = "adoptopenjdk-jre-16.0.0+36"
    `;
      const result7 = extractPackageFile(content7);
      expect(result7).toMatchObject({
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
