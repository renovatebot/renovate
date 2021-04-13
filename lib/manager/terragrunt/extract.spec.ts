import { readFileSync } from 'fs';
import { getName } from '../../../test/util';
import { extractPackageFile } from './extract';

const tg1 = readFileSync('lib/manager/terragrunt/__fixtures__/2.hcl', 'utf8');
const tg2 = `terragrunt {
  source = "../../modules/fe"
}
`;

describe(getName(__filename), () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });
    it('extracts terragrunt sources', () => {
      const res = extractPackageFile(tg1);
      expect(res).toMatchSnapshot();
      expect(res.deps).toHaveLength(30);
      expect(res.deps.filter((dep) => dep.skipReason)).toHaveLength(5);
    });
    it('returns null if only local terragrunt deps', () => {
      expect(extractPackageFile(tg2)).toBeNull();
    });
  });
});
