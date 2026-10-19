import { codeBlock } from 'common-tags';
import type { SimpleGit } from 'simple-git';
import type { DirectoryResult } from 'tmp-promise';
import { dir } from 'tmp-promise';
import upath from 'upath';
import { mock } from 'vitest-mock-extended';
import { clearEnv, fs } from '~test/util.ts';
import { GlobalConfig } from '../../../config/global.ts';
import type {
  InternalGlobalConfigOptions,
  RepoGlobalConfig,
} from '../../../config/types.ts';
import * as git from '../../../util/git/index.ts';
import type { Upgrade } from '../types.ts';
import { updateDependency } from './index.ts';

vi.mock('../../../util/fs/index.ts');

const createSimpleGit = vi.mocked(git.createSimpleGit);
const gitMock = mock<SimpleGit>();
const baseDir = `${import.meta.dirname}/__fixtures__`;

describe('modules/manager/git-submodules/update', () => {
  beforeEach(() => {
    GlobalConfig.set({ localDir: baseDir });
    clearEnv();

    createSimpleGit.mockReturnValue(gitMock);
  });

  describe('updateDependency', () => {
    let upgrade: Upgrade;
    let adminConfig: RepoGlobalConfig & InternalGlobalConfigOptions;
    let tmpDir: DirectoryResult;

    beforeAll(async () => {
      upgrade = { depName: 'renovate' };

      tmpDir = await dir({ unsafeCleanup: true });
      adminConfig = { localDir: upath.join(tmpDir.path) };
      GlobalConfig.set(adminConfig);
    });

    afterAll(async () => {
      await tmpDir.cleanup();
      GlobalConfig.reset();
    });

    it('returns null on error', async () => {
      gitMock.submoduleUpdate.mockRejectedValue(new Error());

      const update = await updateDependency({
        fileContent: '',
        packageFile: '.gitmodules',
        upgrade,
      });
      expect(update).toBeNull();
    });

    it('returns content on update', async () => {
      gitMock.submoduleUpdate.mockResolvedValue('');
      gitMock.checkout.mockResolvedValue('');

      const update = await updateDependency({
        fileContent: '',
        packageFile: '.gitmodules',
        upgrade,
      });
      expect(update).toBe('');
    });

    it('requests Git authentication for submodule commands', async () => {
      gitMock.submoduleUpdate.mockResolvedValue('');
      gitMock.checkout.mockResolvedValue('');

      const update = await updateDependency({
        fileContent: '',
        packageFile: '.gitmodules',
        upgrade,
      });
      expect(update).toBe('');
      expect(createSimpleGit).toHaveBeenCalledTimes(2);
      expect(createSimpleGit).toHaveBeenNthCalledWith(1, {
        config: { baseDir },
        authentication: {
          hostTypes: ['git-tags', 'git-refs'],
        },
      });
      expect(createSimpleGit).toHaveBeenNthCalledWith(2, {
        config: { baseDir: upath.join(baseDir, 'renovate') },
        authentication: {
          hostTypes: ['git-tags', 'git-refs'],
        },
      });
    });

    it('update gitmodule branch value if value changed', async () => {
      gitMock.submoduleUpdate.mockResolvedValue('');
      gitMock.checkout.mockResolvedValue('');
      const updatedGitModules = codeBlock`
        [submodule "renovate"]
              path = deps/renovate
              url = https://github.com/renovatebot/renovate.git
              branch = v0.0.2
      `;
      fs.readLocalFile.mockResolvedValueOnce(updatedGitModules);

      upgrade = {
        depName: 'renovate',
        currentValue: 'v0.0.1',
        newValue: 'v0.0.2',
        packageFile: '.gitmodules',
      };
      const update = await updateDependency({
        fileContent: '',
        packageFile: '.gitmodules',
        upgrade,
      });
      expect(update).toBe(updatedGitModules);
      expect(gitMock.subModule).toHaveBeenCalledExactlyOnceWith([
        'set-branch',
        '--branch',
        'v0.0.2',
        'renovate',
      ]);
    });

    it('do not update gitmodule branch value if value not changed', async () => {
      gitMock.submoduleUpdate.mockResolvedValue('');
      gitMock.checkout.mockResolvedValue('');
      upgrade = {
        depName: 'renovate',
        currentValue: 'main',
        newValue: 'main',
        packageFile: '.gitmodules',
      };
      const update = await updateDependency({
        fileContent: '',
        packageFile: '.gitmodules',
        upgrade,
      });
      expect(update).toBe('');
      expect(gitMock.subModule).toHaveBeenCalledTimes(0);
    });
  });
});
