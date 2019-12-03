import { readFileSync } from 'fs';
import { extractPackageFile } from '../../../lib/manager/terraform-provider/extract';

const tf1 = readFileSync(
  'test/datasource/terraform-provider/_fixtures/1.tf',
  'utf8'
);

describe('lib/manager/terraform-provider/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });
    it('extracts', () => {
      const res = extractPackageFile(tf1);
      expect(res).toMatchSnapshot();
      expect(res.deps).toHaveLength(5);
      expect(res.deps.filter(dep => dep.skipReason)).toHaveLength(2);
    });
  });
});
