import _simpleGit from 'simple-git/promise';
import extractPackageFile from './extract';
import { PackageFile } from '../common';

jest.mock('simple-git/promise');
const simpleGit: jest.Mock<Partial<_simpleGit.SimpleGit>> = _simpleGit as never;
const Git: typeof _simpleGit = jest.requireActual('simple-git/promise');

const localDir = `${__dirname}/__fixtures__`;

describe('lib/manager/gitsubmodules/extract', () => {
  beforeAll(() => {
    simpleGit.mockImplementation((basePath?: string) => {
      const git = Git(basePath);
      return {
        subModule() {
          return Promise.resolve('4b825dc642cb6eb9a060e54bf8d69288fbee4904');
        },
        raw(options: string | string[]): Promise<string> {
          if (options.includes('remote.origin.url')) {
            return Promise.resolve(
              'https://github.com/renovatebot/renovate.git'
            );
          }
          return git.raw(options);
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
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(1);
      res = await extractPackageFile('', '.gitmodules.3', { localDir });
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(1);
      res = await extractPackageFile('', '.gitmodules.4', { localDir });
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(1);
      res = await extractPackageFile('', '.gitmodules.5', { localDir });
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(3);
    });
  });
});
