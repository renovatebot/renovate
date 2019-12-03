import _simpleGit from 'simple-git/promise';
import { dir } from 'tmp-promise';

import updateDependency from '../../../lib/manager/git-submodules/update';

jest.mock('simple-git/promise.js');
const simpleGit: any = _simpleGit;

describe('manager/git-submodules/update', () => {
  describe('updateDependency', () => {
    it('returns null on error', async () => {
      simpleGit.mockReturnValue({
        raw() {
          throw new Error();
        },
      });
      const update = await updateDependency('', {});
      expect(update).toBeNull();
    });
    it('returns content on update', async () => {
      const tmpDir = await dir();
      simpleGit.mockReturnValue({
        raw() {
          return Promise.resolve();
        },
      });
      const update = await updateDependency('', { localDir: tmpDir.path });
      expect(update).toEqual('');
    });
  });
});
