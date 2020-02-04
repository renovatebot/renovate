import { readFileSync } from 'fs';
import { extractPackageFile } from './extract';

const file1 = readFileSync(
  'lib/manager/circleci/_fixtures__/config.yml',
  'utf8'
);
const file2 = readFileSync(
  'lib/manager/circleci/_fixtures__/config2.yml',
  'utf8'
);

describe('lib/manager/circleci/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });
    it('extracts multiple image lines', () => {
      const res = extractPackageFile(file1);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(4);
    });
    it('extracts orbs too', () => {
      const res = extractPackageFile(file2);
      expect(res.deps).toMatchSnapshot();
      // expect(res.deps).toHaveLength(4);
    });
  });
});
