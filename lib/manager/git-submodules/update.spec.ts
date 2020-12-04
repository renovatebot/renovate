import _simpleGit from 'simple-git';
import { dir } from 'tmp-promise';
import { Upgrade } from '../common';

import updateDependency from './update';

jest.mock('simple-git');
const simpleGit: any = _simpleGit;

describe('manager/git-submodules/update', () => {
  describe('updateDependency', () => {
    let upgrade: Upgrade;
    beforeAll(async () => {
      const tmpDir = await dir();
      upgrade = { localDir: tmpDir.path, depName: 'renovate' };
    });
    it('returns null on error', async () => {
      simpleGit.mockReturnValue({
        submoduleUpdate() {
          throw new Error();
        },
      });
      const update = await updateDependency({
        fileContent: '',
        upgrade,
      });
      expect(update).toBeNull();
    });
    it('returns content on update', async () => {
      simpleGit.mockReturnValue({
        submoduleUpdate() {
          return Promise.resolve();
        },
        checkout() {
          return Promise.resolve();
        },
      });
      const update = await updateDependency({
        fileContent: '',
        upgrade,
      });
      expect(update).toEqual('');
    });
  });
});
