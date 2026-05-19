import { extractPackageFile } from './extract.ts';
import { extractPep723 as _extractPep723 } from './utils.ts';

vi.mock('./utils.ts');

const extractPep723 = vi.mocked(_extractPep723);

describe('modules/manager/pep723/extract', () => {
  describe('extractPackageFile()', () => {
    it('should extract dependencies', () => {
      const extractedDeps = {
        deps: [{ depName: 'dep1' }, { depName: 'dep2' }],
      };
      extractPep723.mockReturnValueOnce(extractedDeps);

      const res = extractPackageFile('foo', 'foo.py');

      expect(res).toEqual(extractedDeps);
    });
  });
});
