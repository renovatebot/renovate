import { readFileSync } from 'fs';
import { testName } from '../../../test/util';
import { extractPackageFile } from './extract';

const file1 = readFileSync(
  'lib/manager/cloudbuild/__fixtures__/cloudbuild.yml',
  'utf8'
);

describe(testName(), () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });
    it('extracts multiple image lines', () => {
      const res = extractPackageFile(file1);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(3);
    });
  });
});
