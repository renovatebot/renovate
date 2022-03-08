import _simpleGit, { Response, SimpleGit } from 'simple-git';
import { DirectoryResult, dir } from 'tmp-promise';
import { join } from 'upath';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import type { Upgrade } from '../types';
import updateDependency from './update';

jest.mock('simple-git');
const simpleGit: jest.Mock<Partial<SimpleGit>> = _simpleGit as never;

describe('modules/manager/git-submodules/update', () => {
  describe('updateDependency', () => {
    let upgrade: Upgrade;
    let adminConfig: RepoGlobalConfig;
    let tmpDir: DirectoryResult;
    beforeAll(async () => {
      upgrade = { depName: 'renovate' };

      tmpDir = await dir({ unsafeCleanup: true });
      adminConfig = { localDir: join(tmpDir.path) };
      GlobalConfig.set(adminConfig);
    });
    afterAll(async () => {
      await tmpDir.cleanup();
      GlobalConfig.reset();
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
          return Promise.resolve(null) as Response<string>;
        },
        checkout() {
          return Promise.resolve(null) as Response<string>;
        },
      });
      const update = await updateDependency({
        fileContent: '',
        upgrade,
      });
      expect(update).toBe('');
    });
  });
});
