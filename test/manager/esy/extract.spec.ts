import { readFileSync } from 'fs';
import { extractPackageFile } from '../../../lib/manager/esy/extract';

const package1json = readFileSync(
  'test/manager/esy/_fixtures/package.1.json',
  'utf8'
);
const package2json = readFileSync(
  'test/manager/esy/_fixtures/package.1.json',
  'utf8'
);

describe('lib/manager/esy/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', async () => {
      const content = '';
      const fileName = '';
      expect(await extractPackageFile(content, fileName)).toBeNull();
    });
    it('parses a simple JSON object', async () => {
      const content = package1json;
      const fileName = 'package.json';
      expect(await extractPackageFile(content, fileName)).not.toBeNull();
      expect(await extractPackageFile(content, fileName)).toMatchSnapshot();
    });
    it('parses a simple JSON object', async () => {
      const content = package2json;
      const fileName = 'package.json';
      expect(await extractPackageFile(content, fileName)).not.toBeNull();
      expect(await extractPackageFile(content, fileName)).toMatchSnapshot();
    });
  });
});
