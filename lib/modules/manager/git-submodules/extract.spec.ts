import is from '@sindresorhus/is';
import { mock } from 'jest-mock-extended';
import _simpleGit, {
  Response,
  SimpleGit,
  SimpleGitFactory,
  TaskOptions,
} from 'simple-git';
import { GlobalConfig } from '../../../config/global';
import * as hostRules from '../../../util/host-rules';
import type { PackageFile } from '../types';
import { extractPackageFile } from '.';

jest.mock('simple-git');
const simpleGit: jest.Mock<Partial<SimpleGit>> = _simpleGit as never;
const Git = jest.requireActual('simple-git') as SimpleGitFactory;

describe('modules/manager/git-submodules/extract', () => {
  // flaky ci tests
  jest.setTimeout(10 * 1000);

  beforeAll(() => {
    simpleGit.mockImplementation((basePath: string) => {
      const git = Git(basePath);
      return {
        subModule(): Response<string> {
          return Promise.resolve(
            '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
          ) as Response<string>;
        },
        raw(options: string | string[] | TaskOptions): Response<string> {
          if (
            (is.string(options) || is.array(options, is.string)) &&
            options.includes('remote.origin.url')
          ) {
            return Promise.resolve(
              'https://github.com/renovatebot/renovate.git'
            ) as Response<string>;
          }
          return git.raw(options);
        },
        listRemote(): Response<string> {
          return Promise.resolve(
            'ref: refs/heads/main  HEAD\n5701164b9f5edba1f6ca114c491a564ffb55a964        HEAD'
          ) as Response<string>;
        },
        ...mock<Omit<SimpleGit, 'subModule' | 'raw' | 'listRemote'>>(),
      };
    });
  });

  describe('extractPackageFile()', () => {
    it('extracts submodules', async () => {
      GlobalConfig.set({ localDir: `${__dirname}/__fixtures__` });
      hostRules.add({ matchHost: 'github.com', token: '123test' });
      let res: PackageFile | null;
      expect(await extractPackageFile('', '.gitmodules.1', {})).toBeNull();
      res = await extractPackageFile('', '.gitmodules.2', {});
      expect(res?.deps).toHaveLength(1);
      expect(res?.deps[0].currentValue).toBe('main');
      res = await extractPackageFile('', '.gitmodules.3', {});
      expect(res?.deps).toHaveLength(1);
      res = await extractPackageFile('', '.gitmodules.4', {});
      expect(res?.deps).toHaveLength(1);
      res = await extractPackageFile('', '.gitmodules.5', {});
      expect(res?.deps).toHaveLength(3);
      expect(res?.deps[2].packageName).toBe(
        'https://github.com/renovatebot/renovate-config.git'
      );
    });
  });
});
