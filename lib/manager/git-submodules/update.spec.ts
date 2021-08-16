import _simpleGit from 'simple-git';
import { dir } from 'tmp-promise';
import { join } from 'upath';
import { setAdminConfig } from '../../config/admin';
import type { RepoAdminConfig } from '../../config/types';
import type { Upgrade } from '../types';
import updateDependency from './update';

jest.mock('simple-git');
const simpleGit: any = _simpleGit;

describe('manager/git-submodules/update', () => {
  describe('updateDependency', () => {
    let upgrade: Upgrade;
    let adminConfig: RepoAdminConfig;
    beforeAll(async () => {
      upgrade = { depName: 'renovate' };

      const tmpDir = await dir();
      adminConfig = { localDir: join(tmpDir.path) };
      setAdminConfig(adminConfig);
    });
    afterAll(() => {
      setAdminConfig();
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
