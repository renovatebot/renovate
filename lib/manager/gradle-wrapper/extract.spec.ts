import { readFileSync } from 'fs';
import { resolve } from 'upath';
import { getName } from '../../../test/util';
import { extractPackageFile } from './extract';

const propertiesFile1 = readFileSync(
  resolve(__dirname, './__fixtures__/gradle-wrapper-1.properties'),
  'utf8'
);
const propertiesFile2 = readFileSync(
  resolve(__dirname, './__fixtures__/gradle-wrapper-2.properties'),
  'utf8'
);
const propertiesFile3 = readFileSync(
  resolve(__dirname, './__fixtures__/gradle-wrapper-3.properties'),
  'utf8'
);
const propertiesFile4 = readFileSync(
  resolve(__dirname, './__fixtures__/gradle-wrapper-4.properties'),
  'utf8'
);
const whitespacePropertiesFile = readFileSync(
  resolve(__dirname, './__fixtures__/gradle-wrapper-whitespace.properties'),
  'utf8'
);

describe(getName(__filename), () => {
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

    it('extracts prerelease version line', () => {
      const res = extractPackageFile(propertiesFile3);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps[0].currentValue).toBe('7.0-milestone-1');
    });

    it('ignores invalid', () => {
      const res = extractPackageFile(propertiesFile4);
      expect(res).toBeNull();
    });

    it('handles whitespace', () => {
      const res = extractPackageFile(whitespacePropertiesFile);
      expect(res.deps).toMatchSnapshot();
    });
  });
});
