import is from '@sindresorhus/is';
import { mock } from 'jest-mock-extended';
import { Response, SimpleGit, SimpleGitFactory, simpleGit } from 'simple-git';
import { GlobalConfig } from '../../../config/global';
import * as hostRules from '../../../util/host-rules';
import { extractPackageFile } from '.';

jest.mock('simple-git');
const simpleGitFactoryMock = simpleGit as jest.Mock<Partial<SimpleGit>>;
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
const Git = jest.requireActual('simple-git') as SimpleGitFactory;

const gitMock = mock<SimpleGit>();

describe('modules/manager/git-submodules/extract', () => {
  beforeEach(() => {
    GlobalConfig.set({ localDir: `${__dirname}/__fixtures__` });
    // clear host rules
    hostRules.clear();
    // clear environment variables
    process.env = {};

    simpleGitFactoryMock.mockImplementation((basePath: string) => {
      const git = Git(basePath);

      gitMock.env.mockImplementation(() => gitMock);
      gitMock.subModule.mockResolvedValue(
        '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
      );

      gitMock.raw.mockImplementation((options) => {
        if (
          (is.string(options) || is.array(options, is.string)) &&
          options.includes('remote.origin.url')
        ) {
          return Promise.resolve(
            'https://github.com/renovatebot/renovate.git'
          ) as Response<string>;
        }
        return git.raw(options);
      });
      return gitMock;
    });
  });

  describe('extractPackageFile()', () => {
    it('empty submodule returns null', async () => {
      expect(await extractPackageFile('', '.gitmodules.1', {})).toBeNull();
    });

    it('default branch is detected when no branch is specified', async () => {
      gitMock.listRemote.mockResolvedValueOnce(
        'ref: refs/heads/main  HEAD\n5701164b9f5edba1f6ca114c491a564ffb55a964        HEAD'
      );
      const res = await extractPackageFile('', '.gitmodules.2', {});
      expect(res?.deps).toHaveLength(1);
      expect(res?.deps[0].currentValue).toBe('main');
    });

    it('default to master if no branch can be detected', async () => {
      const res = await extractPackageFile('', '.gitmodules.2', {});
      expect(res?.deps).toHaveLength(1);
      expect(res?.deps[0].currentValue).toBe('master');
    });

    it('given branch is used when branch is specified', async () => {
      const res = await extractPackageFile('', '.gitmodules.3', {});
      expect(res?.deps).toHaveLength(1);
      expect(res?.deps[0].currentValue).toBe('staging');
    });

    it('submodule packageName is constructed from relative path', async () => {
      const res = await extractPackageFile('', '.gitmodules.4', {});
      expect(res?.deps).toHaveLength(1);
      expect(res?.deps[0].packageName).toBe(
        'https://github.com/PowerShell/PowerShell-Docs'
      );
    });

    it('extracts multiple submodules', async () => {
      hostRules.add({ matchHost: 'github.com', token: '123test' });
      hostRules.add({
        matchHost: 'domain.test',
        token: 'abc',
        hostType: 'git-refs',
      });
      hostRules.add({
        matchHost: 'gitlab.com',
        token: 'xyz',
        hostType: 'gitlab',
      });
      gitMock.listRemote.mockResolvedValueOnce(
        'ref: refs/heads/main  HEAD\n5701164b9f5edba1f6ca114c491a564ffb55a964        HEAD'
      );
      gitMock.listRemote.mockResolvedValueOnce(
        'ref: refs/heads/main  HEAD\n5701164b9f5edba1f6ca114c491a564ffb55a964        HEAD'
      );
      gitMock.listRemote.mockResolvedValueOnce(
        'ref: refs/heads/main  HEAD\n5701164b9f5edba1f6ca114c491a564ffb55a964        HEAD'
      );
      gitMock.listRemote.mockResolvedValueOnce(
        'ref: refs/heads/master  HEAD\n5701164b9f5edba1f6ca114c491a564ffb55a964        HEAD'
      );
      gitMock.listRemote.mockResolvedValueOnce(
        'ref: refs/heads/dev  HEAD\n5701164b9f5edba1f6ca114c491a564ffb55a964        HEAD'
      );
      const res = await extractPackageFile('', '.gitmodules.5', {});
      expect(res).toEqual({
        datasource: 'git-refs',
        deps: [
          {
            currentDigest: '4b825dc642cb6eb9a060e54bf8d69288fbee4904',
            currentValue: 'main',
            depName: 'deps/renovate',
            packageName: 'https://github.com/renovatebot/renovate.git',
          },
          {
            currentDigest: '4b825dc642cb6eb9a060e54bf8d69288fbee4904',
            currentValue: 'main',
            depName: 'deps/renovate-pro',
            packageName: 'https://github.com/renovatebot/pro.git',
          },
          {
            currentDigest: '4b825dc642cb6eb9a060e54bf8d69288fbee4904',
            currentValue: 'main',
            depName: 'deps/renovate-config',
            packageName: 'https://github.com/renovatebot/renovate-config.git',
          },
          {
            currentDigest: '4b825dc642cb6eb9a060e54bf8d69288fbee4904',
            currentValue: 'master',
            depName: 'some-other',
            packageName: 'https://domain.test/some/other.git',
          },
          {
            currentDigest: '4b825dc642cb6eb9a060e54bf8d69288fbee4904',
            currentValue: 'dev',
            depName: 'some-gitlab',
            packageName: 'https://gitlab.com/some/repo.git',
          },
        ],
      });
    });
  });
});
