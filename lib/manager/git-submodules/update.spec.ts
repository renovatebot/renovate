import _simpleGit from 'simple-git';
import { DirectoryResult, dir } from 'tmp-promise';
import { join } from 'upath';
import { setGlobalConfig } from '../../config/global';
import type { RepoGlobalConfig } from '../../config/types';
import type { Upgrade } from '../types';
import updateDependency from './update';

jest.mock('simple-git');
const simpleGit: any = _simpleGit;

describe('manager/git-submodules/update', () => {
  describe('updateDependency', () => {
    let upgrade: Upgrade;
    let adminConfig: RepoGlobalConfig;
    let tmpDir: DirectoryResult;
    beforeAll(async () => {
      upgrade = { depName: 'renovate' };

      tmpDir = await dir({ unsafeCleanup: true });
      adminConfig = { localDir: join(tmpDir.path) };
      setGlobalConfig(adminConfig);
    });
    afterAll(async () => {
      await tmpDir.cleanup();
      setGlobalConfig();
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
