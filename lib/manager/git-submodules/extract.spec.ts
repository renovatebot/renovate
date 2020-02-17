import _simpleGit from 'simple-git/promise';
import extractPackageFile from './extract';

jest.mock('simple-git/promise');
const simpleGit: any = _simpleGit;
const Git = jest.requireActual('simple-git/promise');

const localDir = `${__dirname}/__fixtures__`;

describe('lib/manager/gitsubmodules/extract', () => {
  beforeAll(() => {
    simpleGit.mockReturnValue({
      subModule() {
        return Promise.resolve('4b825dc642cb6eb9a060e54bf8d69288fbee4904');
      },
      raw(options: string[]) {
        if (options.includes('remote.origin.url')) {
          return 'https://github.com/renovatebot/renovate.git';
        }
        return Git().raw(options);
      },
    });
  });
  describe('extractPackageFile()', () => {
    it('handles empty gitmodules file', async () => {
      expect(
        await extractPackageFile({
          fileContent: '',
          fileName: '.gitmodules.1',
          config: { localDir },
        })
      ).toBeNull();
    });
    it('default to master branch', async () => {
      const res = await extractPackageFile({
        fileContent: '',
        fileName: '.gitmodules.2',
        config: { localDir },
      });
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(1);
    });
    it('extract branch', async () => {
      const res = await extractPackageFile({
        fileContent: '',
        fileName: '.gitmodules.3',
        config: { localDir },
      });
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(1);
    });
    it('extract relative URL', async () => {
      const res = await extractPackageFile({
        fileContent: '',
        fileName: '.gitmodules.4',
        config: { localDir },
      });
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(1);
    });

    it('extract name path mismatch', async () => {
      const res = await extractPackageFile({
        fileContent: '',
        fileName: '.gitmodules.5',
        config: { localDir },
      });
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(3);
    });
  });
});
