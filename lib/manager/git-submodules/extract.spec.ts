import _simpleGit, { Response, SimpleGit } from 'simple-git';
import { partial } from '../../../test/util';
import { PackageFile } from '../common';
import extractPackageFile from './extract';

jest.mock('simple-git');
const simpleGit: jest.Mock<Partial<SimpleGit>> = _simpleGit as never;
const Git: typeof _simpleGit = jest.requireActual('simple-git');

const localDir = `${__dirname}/__fixtures__`;

describe('lib/manager/gitsubmodules/extract', () => {
  beforeAll(() => {
    simpleGit.mockImplementation((basePath?: string) => {
      const git = Git(basePath);
      return {
        subModule() {
          return partial<Response<string>>(
            Promise.resolve('4b825dc642cb6eb9a060e54bf8d69288fbee4904')
          );
        },
        raw(options: string | string[]): Response<string> {
          if (options.includes('remote.origin.url')) {
            return partial<Response<string>>(
              Promise.resolve('https://github.com/renovatebot/renovate.git')
            );
          }
          return git.raw(options);
        },
        listRemote(): Response<string> {
          return partial<Response<string>>(
            Promise.resolve(
              'ref: refs/heads/main  HEAD\n5701164b9f5edba1f6ca114c491a564ffb55a964        HEAD'
            )
          );
        },
      };
    });
  });
  describe('extractPackageFile()', () => {
    it('extracts submodules', async () => {
      let res: PackageFile;
      expect(
        await extractPackageFile('', '.gitmodules.1', { localDir })
      ).toBeNull();
      res = await extractPackageFile('', '.gitmodules.2', { localDir });
      expect(res.deps).toHaveLength(1);
      expect(res.deps[0].registryUrls[1]).toEqual('main');
      res = await extractPackageFile('', '.gitmodules.3', { localDir });
      expect(res.deps).toHaveLength(1);
      res = await extractPackageFile('', '.gitmodules.4', { localDir });
      expect(res.deps).toHaveLength(1);
      res = await extractPackageFile('', '.gitmodules.5', { localDir });
      expect(res.deps).toHaveLength(3);
    });
  });
});
