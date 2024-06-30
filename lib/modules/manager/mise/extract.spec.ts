import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

jest.mock('../../../util/fs');

const mise1toml = Fixtures.get('Mise.1.toml');
const mise2toml = Fixtures.get('Mise.2.toml');
const mise3toml = Fixtures.get('Mise.3.toml');

describe('modules/manager/mise/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('')).toBeNull();
    });

    it('returns null for invalid TOML', () => {
      expect(extractPackageFile('foo')).toBeNull();
    });

    it('extracts tools', () => {
      const result = extractPackageFile(mise1toml);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'terraform',
            currentValue: '1.8.0',
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

    it('extracts tools with multiple versions', () => {
      const result = extractPackageFile(mise2toml);
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

    it('invalid datasource', () => {
      const result = extractPackageFile(mise3toml);
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'fake-tool',
            skipReason: 'unsupported-datasource',
          },
        ],
      });
    });
  });
});
