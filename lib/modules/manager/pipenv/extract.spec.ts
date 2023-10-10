import { Fixtures } from '../../../../test/fixtures';
import { fs as fsutil } from '../../../../test/util';
import { extractPackageFile } from '.';

jest.mock('../../../util/fs');

const pipfile1 = Fixtures.get('Pipfile1');
const pipfile2 = Fixtures.get('Pipfile2');
const pipfile3 = Fixtures.get('Pipfile3');
const pipfile4 = Fixtures.get('Pipfile4');
const pipfile5 = Fixtures.get('Pipfile5');

describe('modules/manager/pipenv/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', async () => {
      expect(await extractPackageFile('[packages]\r\n', 'Pipfile')).toBeNull();
    });

    it('returns null for invalid toml file', async () => {
      expect(await extractPackageFile('nothing here', 'Pipfile')).toBeNull();
    });

    it('extracts dependencies', async () => {
      fsutil.localPathExists.mockResolvedValueOnce(true);
      const res = await extractPackageFile(pipfile1, 'Pipfile');
      expect(res).toMatchSnapshot();
      expect(res?.deps).toHaveLength(6);
      expect(res?.deps.filter((dep) => !dep.skipReason)).toHaveLength(4);
    });

    it('marks packages with "extras" as skipReason === unspecified-version', async () => {
      const res = await extractPackageFile(pipfile3, 'Pipfile');
      expect(res?.deps.filter((r) => !r.skipReason)).toHaveLength(0);
      expect(res?.deps.filter((r) => r.skipReason)).toHaveLength(6);
    });

    it('extracts multiple dependencies', async () => {
      fsutil.localPathExists.mockResolvedValueOnce(true);
      const res = await extractPackageFile(pipfile2, 'Pipfile');
      expect(res).toMatchSnapshot();
      expect(res?.deps).toHaveLength(5);
    });

    it('ignores git dependencies', async () => {
      const content =
        '[packages]\r\nflask = {git = "https://github.com/pallets/flask.git"}\r\nwerkzeug = ">=0.14"';
      const res = await extractPackageFile(content, 'Pipfile');
      expect(res?.deps.filter((r) => !r.skipReason)).toHaveLength(1);
    });

    it('ignores invalid package names', async () => {
      const content = '[packages]\r\nfoo = "==1.0.0"\r\n_invalid = "==1.0.0"';
      const res = await extractPackageFile(content, 'Pipfile');
      expect(res?.deps).toHaveLength(2);
      expect(res?.deps.filter((dep) => !dep.skipReason)).toHaveLength(1);
    });

    it('ignores relative path dependencies', async () => {
      const content = '[packages]\r\nfoo = "==1.0.0"\r\ntest = {path = "."}';
      const res = await extractPackageFile(content, 'Pipfile');
      expect(res?.deps.filter((r) => !r.skipReason)).toHaveLength(1);
    });

    it('ignores invalid versions', async () => {
      const content = '[packages]\r\nfoo = "==1.0.0"\r\nsome-package = "==0 0"';
      const res = await extractPackageFile(content, 'Pipfile');
      expect(res?.deps).toHaveLength(2);
      expect(res?.deps.filter((dep) => !dep.skipReason)).toHaveLength(1);
    });

    it('extracts all sources', async () => {
      const content =
        '[[source]]\r\nurl = "source-url"\r\n' +
        '[[source]]\r\nurl = "other-source-url"\r\n' +
        '[packages]\r\nfoo = "==1.0.0"\r\n';
      const res = await extractPackageFile(content, 'Pipfile');
      expect(res?.registryUrls).toEqual(['source-url', 'other-source-url']);
    });

    it('extracts example pipfile', async () => {
      fsutil.localPathExists.mockResolvedValueOnce(true);
      const res = await extractPackageFile(pipfile4, 'Pipfile');
      expect(res).toMatchSnapshot({
        extractedConstraints: { python: '== 2.7.*' },
        deps: [
          { depName: 'requests', skipReason: 'unspecified-version' },
          {
            currentValue: '>0.5.0',
            datasource: 'pypi',
            depName: 'records',
            depType: 'packages',
          },
          { depName: 'django', skipReason: 'git-dependency' },
          { depName: 'e682b37', skipReason: 'file-dependency' },
          { depName: 'e1839a8', skipReason: 'local-dependency' },
          { depName: 'pywinusb', skipReason: 'unspecified-version' },
          { currentValue: '*', skipReason: 'unspecified-version' },
          {
            currentValue: '>=1.0,<3.0',
            datasource: 'pypi',
            depName: 'unittest2',
            depType: 'dev-packages',
            managerData: { nestedVersion: true },
          },
        ],
        lockFiles: ['Pipfile.lock'],
        registryUrls: ['https://pypi.python.org/simple'],
      });
    });

    it('supports custom index', async () => {
      fsutil.localPathExists.mockResolvedValueOnce(true);
      const res = await extractPackageFile(pipfile5, 'Pipfile');
      expect(res).toMatchSnapshot();
      expect(res?.registryUrls).toBeDefined();
      expect(res?.registryUrls).toHaveLength(2);
      expect(res?.deps[0].registryUrls).toBeDefined();
      expect(res?.deps[0].registryUrls).toHaveLength(1);
    });

    it('gets python constraint from python_version', async () => {
      const content =
        '[packages]\r\nfoo = "==1.0.0"\r\n' +
        '[requires]\r\npython_version = "3.8"';
      const res = await extractPackageFile(content, 'Pipfile');
      expect(res?.extractedConstraints?.python).toBe('== 3.8.*');
    });

    it('gets python constraint from python_full_version', async () => {
      const content =
        '[packages]\r\nfoo = "==1.0.0"\r\n' +
        '[requires]\r\npython_full_version = "3.8.6"';
      const res = await extractPackageFile(content, 'Pipfile');
      expect(res?.extractedConstraints?.python).toBe('== 3.8.6');
    });

    it('gets pipenv constraint from packages', async () => {
      const content = '[packages]\r\npipenv = "==2020.8.13"';
      const res = await extractPackageFile(content, 'Pipfile');
      expect(res?.extractedConstraints?.pipenv).toBe('==2020.8.13');
    });

    it('gets pipenv constraint from dev-packages', async () => {
      const content = '[dev-packages]\r\npipenv = "==2020.8.13"';
      const res = await extractPackageFile(content, 'Pipfile');
      expect(res?.extractedConstraints?.pipenv).toBe('==2020.8.13');
    });
  });
});
