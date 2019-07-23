import { readFileSync } from 'fs';
import { extractPackageFile } from '../../../lib/manager/gradle-wrapper/extract';

const propertiesFile1 = readFileSync(
  'test/datasource/gradle-wrapper/_fixtures/gradle-wrapper-1.properties',
  'utf8'
);
const propertiesFile2 = readFileSync(
  'test/datasource/gradle-wrapper/_fixtures/gradle-wrapper-2.properties',
  'utf8'
);

describe('lib/manager/gradle-wrapper/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });

    it('extracts bin version line', () => {
      const res = extractPackageFile(propertiesFile1);
      expect(res.deps).toMatchSnapshot();
    });

    it('extracts all version line', () => {
      const res = extractPackageFile(propertiesFile2);
      expect(res.deps).toMatchSnapshot();
    });
  });
});
