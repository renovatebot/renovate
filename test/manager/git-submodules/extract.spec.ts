import { resolve } from 'path';

import extractPackageFile from '../../../lib/manager/git-submodules/extract';

const g1 = resolve(__dirname, './_fixtures/.gitmodules1');

describe('manager/git-submodules/update', () => {
  describe('extractPackageFile', () => {
    it('returns master as default', async () => {
      const packageFile = await extractPackageFile('', g1, { localDir: '' });
      expect(packageFile).not.toBeNull();
    });
  });
});
