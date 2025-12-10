import { isArray, isString } from '@sindresorhus/is';
import type { Response, SimpleGit } from 'simple-git';
import Git from 'simple-git';
import { mock } from 'vitest-mock-extended';
import { GlobalConfig } from '../../../config/global';
import * as hostRules from '../../../util/host-rules';
import { extractPackageFile } from '.';

vi.mock('simple-git', () => ({ default: vi.fn() }));
const simpleGitFactoryMock = vi.mocked(Git);

const gitMock = mock<SimpleGit>();

describe('modules/manager/git-submodules/extract', () => {
  beforeEach(async () => {
    const { simpleGit: Git } =
      await vi.importActual<typeof import('simple-git')>('simple-git');
    GlobalConfig.set({ localDir: `${__dirname}/__fixtures__` });
    // clear host rules
    hostRules.clear();
    // clear environment variables
    process.env = {};

    simpleGitFactoryMock.mockImplementation((...args: any[]) => {
      const git = Git(...args);

      gitMock.env.mockImplementation(() => gitMock);
      gitMock.subModule.mockResolvedValue(
        '4b825dc642cb6eb9a060e54bf8d69288fbee4904',
      );

      gitMock.raw.mockImplementation((options) => {
        if (
          (isString(options) || isArray(options, isString)) &&
          options.includes('remote.origin.url')
        ) {
          return Promise.resolve(
            'https://github.com/renovatebot/renovate.git',
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

    it('currentValue is unset when no branch is specified', async () => {
      const res = await extractPackageFile('', '.gitmodules.2', {});
      expect(res?.deps).toHaveLength(1);
      expect(res?.deps[0].currentValue).toBeUndefined();
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
        'https://github.com/PowerShell/PowerShell-Docs',
      );
    });

    it('fallback to current branch if special value is detected', async () => {
      gitMock.branch.mockResolvedValueOnce({
        all: ['staging', 'main'],
        branches: {
          staging: {
            current: true,
            name: 'staging',
            commit: '9eeb873',
            label: 'staging branch',
            linkedWorkTree: false,
          },
          main: {
            current: false,
            name: 'main',
            commit: 'e14c7e1',
            label: 'main branch',
            linkedWorkTree: false,
          },
        },
        current: 'staging',
        detached: false,
      });

      const res = await extractPackageFile('', '.gitmodules.7', {});
      expect(res).toEqual({
        datasource: 'git-refs',
        deps: [
          {
            currentDigest: '4b825dc642cb6eb9a060e54bf8d69288fbee4904',
            currentValue: 'staging',
            depName: 'PowerShell-Docs',
            packageName: 'https://github.com/PowerShell/PowerShell-Docs',
          },
        ],
      });
    });

    it('given semver version is extracted from branch and versioning is set to semver', async () => {
      const res = await extractPackageFile('', '.gitmodules.8', {});
      expect(res).toEqual({
        datasource: 'git-refs',
        deps: [
          {
            currentDigest: '4b825dc642cb6eb9a060e54bf8d69288fbee4904',
            currentValue: 'v0.0.1',
            depName: 'deps/renovate1',
            packageName: 'https://github.com/renovatebot/renovate.git',
            versioning: 'semver',
          },
          {
            currentDigest: '4b825dc642cb6eb9a060e54bf8d69288fbee4904',
            currentValue: '0.0.1',
            depName: 'deps/renovate2',
            packageName: 'https://github.com/renovatebot/renovate.git',
            versioning: 'semver',
          },
          {
            currentDigest: '4b825dc642cb6eb9a060e54bf8d69288fbee4904',
            currentValue: 'not-a-semver',
            packageName: 'https://github.com/renovatebot/renovate.git',
            depName: 'deps/renovate3',
          },
        ],
      });
    });
  });
});
