import { Fixtures } from '../../../test/fixtures';
import { extractPackageFile } from './extract';

describe('manager/terragrunt/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });
    it('extracts terragrunt sources', () => {
      const res = extractPackageFile(Fixtures.get('2.hcl'));
      expect(res).toMatchSnapshot();
      expect(res.deps).toHaveLength(30);
      expect(res.deps.filter((dep) => dep.skipReason)).toHaveLength(5);
    });
    it('returns null if only local terragrunt deps', () => {
      expect(
        extractPackageFile(`terragrunt {
        source = "../../modules/fe"
      }
      `)
      ).toBeNull();
    });
  });
});
