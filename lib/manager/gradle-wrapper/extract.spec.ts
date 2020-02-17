import { readFileSync } from 'fs';
import { resolve } from 'path';
import { extractPackageFile } from './extract';

const propertiesFile1 = readFileSync(
  resolve(__dirname, './__fixtures__/gradle-wrapper-1.properties'),
  'utf8'
);
const propertiesFile2 = readFileSync(
  resolve(__dirname, './__fixtures__/gradle-wrapper-2.properties'),
  'utf8'
);

describe('lib/manager/gradle-wrapper/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile({ fileContent: 'nothing here' })).toBeNull();
    });

    it('extracts bin version line', () => {
      const res = extractPackageFile({ fileContent: propertiesFile1 });
      expect(res.deps).toMatchSnapshot();
    });

    it('extracts all version line', () => {
      const res = extractPackageFile({ fileContent: propertiesFile2 });
      expect(res.deps).toMatchSnapshot();
    });
  });
});
