import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

jest.mock('../../../util/fs');

const mise1toml = Fixtures.get('Mise.1.toml');
const mise2toml = Fixtures.get('Mise.2.toml');
const mise3toml = Fixtures.get('Mise.3.toml');
const mise4toml = Fixtures.get('Mise.4.toml');
const mise5toml = Fixtures.get('Mise.5.toml');

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
  });
});
