import type { SimpleGit } from 'simple-git';
import { simpleGit } from 'simple-git';
import type { DirectoryResult } from 'tmp-promise';
import { dir } from 'tmp-promise';
import upath from 'upath';
import { mock } from 'vitest-mock-extended';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import * as hostRules from '../../../util/host-rules';
import type { Upgrade } from '../types';
import { updateDependency } from '.';
import { fs } from '~test/util';
vi.mock('../../../util/fs');

vi.mock('simple-git');
const simpleGitFactoryMock = vi.mocked(simpleGit);
const gitMock = mock<SimpleGit>();

describe('modules/manager/git-submodules/update', () => {
  beforeEach(() => {
    GlobalConfig.set({ localDir: `${__dirname}/__fixtures__` });
    // clear host rules
    hostRules.clear();
    // clear environment variables
    process.env = {};

    simpleGitFactoryMock.mockReturnValue(gitMock);
    gitMock.env.mockReturnValue(gitMock);
  });

  describe('updateDependency', () => {
    let upgrade: Upgrade;
    let adminConfig: RepoGlobalConfig;
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
        upgrade,
      });
      expect(update).toBeNull();
    });

    it('returns content on update', async () => {
      gitMock.submoduleUpdate.mockResolvedValue('');
      gitMock.checkout.mockResolvedValue('');

      const update = await updateDependency({
        fileContent: '',
        upgrade,
      });
      expect(update).toBe('');
    });

    it('returns content on update and uses git environment variables', async () => {
      gitMock.submoduleUpdate.mockResolvedValue('');
      gitMock.checkout.mockResolvedValue('');
      hostRules.add({
        hostType: 'github',
        matchHost: 'github.com',
        token: 'abc123',
      });

      const update = await updateDependency({
        fileContent: '',
        upgrade,
      });
      expect(update).toBe('');
      expect(gitMock.env).toHaveBeenCalledWith({
        GIT_CONFIG_COUNT: '3',
        GIT_CONFIG_KEY_0: 'url.https://ssh:abc123@github.com/.insteadOf',
        GIT_CONFIG_KEY_1: 'url.https://git:abc123@github.com/.insteadOf',
        GIT_CONFIG_KEY_2: 'url.https://abc123@github.com/.insteadOf',
        GIT_CONFIG_VALUE_0: 'ssh://git@github.com/',
        GIT_CONFIG_VALUE_1: 'git@github.com:',
        GIT_CONFIG_VALUE_2: 'https://github.com/',
      });
    });

    it('update gitmodule branch value if value changed', async () => {
      gitMock.submoduleUpdate.mockResolvedValue('');
      gitMock.checkout.mockResolvedValue('');
      const updatedGitModules = `[submodule "renovate"]
      path = deps/renovate
      url = https://github.com/renovatebot/renovate.git
      branch = v0.0.2`;
      fs.readLocalFile.mockResolvedValueOnce(updatedGitModules);

      upgrade = {
        depName: 'renovate',
        currentValue: 'v0.0.1',
        newValue: 'v0.0.2',
        packageFile: '.gitmodules',
      };
      const update = await updateDependency({
        fileContent: '',
        upgrade,
      });
      expect(update).toBe(updatedGitModules);
      expect(gitMock.subModule).toHaveBeenCalledWith([
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
        upgrade,
      });
      expect(update).toBe('');
      expect(gitMock.subModule).toHaveBeenCalledTimes(0);
    });

    it('returns content on update and uses git environment variables for git-tags/git-refs', async () => {
      gitMock.submoduleUpdate.mockResolvedValue('');
      gitMock.checkout.mockResolvedValue('');
      hostRules.add({
        hostType: 'git-refs',
        matchHost: 'gitrefs.com',
        username: 'git-refs-user',
        password: 'git-refs-password',
      });
      hostRules.add({
        hostType: 'git-tags',
        matchHost: 'gittags.com',
        username: 'git-tags-user',
        password: 'git-tags-password',
      });

      const update = await updateDependency({
        fileContent: '',
        upgrade,
      });
      expect(update).toBe('');
      expect(gitMock.env).toHaveBeenCalledWith({
        GIT_CONFIG_COUNT: '6',
        GIT_CONFIG_KEY_0:
          'url.https://git-refs-user:git-refs-password@gitrefs.com/.insteadOf',
        GIT_CONFIG_KEY_1:
          'url.https://git-refs-user:git-refs-password@gitrefs.com/.insteadOf',
        GIT_CONFIG_KEY_2:
          'url.https://git-refs-user:git-refs-password@gitrefs.com/.insteadOf',
        GIT_CONFIG_KEY_3:
          'url.https://git-tags-user:git-tags-password@gittags.com/.insteadOf',
        GIT_CONFIG_KEY_4:
          'url.https://git-tags-user:git-tags-password@gittags.com/.insteadOf',
        GIT_CONFIG_KEY_5:
          'url.https://git-tags-user:git-tags-password@gittags.com/.insteadOf',
        GIT_CONFIG_VALUE_0: 'ssh://git@gitrefs.com/',
        GIT_CONFIG_VALUE_1: 'git@gitrefs.com:',
        GIT_CONFIG_VALUE_2: 'https://gitrefs.com/',
        GIT_CONFIG_VALUE_3: 'ssh://git@gittags.com/',
        GIT_CONFIG_VALUE_4: 'git@gittags.com:',
        GIT_CONFIG_VALUE_5: 'https://gittags.com/',
      });
    });
  });
});
