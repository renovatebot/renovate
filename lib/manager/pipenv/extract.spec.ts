import { fs as fsutil, getName, loadFixture } from '../../../test/util';
import { extractPackageFile } from './extract';

jest.mock('../../util/fs');

const pipfile1 = loadFixture(__filename, 'Pipfile1');
const pipfile2 = loadFixture(__filename, 'Pipfile2');
const pipfile3 = loadFixture(__filename, 'Pipfile3');
const pipfile4 = loadFixture(__filename, 'Pipfile4');
const pipfile5 = loadFixture(__filename, 'Pipfile5');

describe(getName(__filename), () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', async () => {
      expect(await extractPackageFile('[packages]\r\n', 'Pipfile')).toBeNull();
    });
    it('returns null for invalid toml file', async () => {
      expect(await extractPackageFile('nothing here', 'Pipfile')).toBeNull();
    });
    it('extracts dependencies', async () => {
      fsutil.localPathExists.mockResolvedValue(true);
      const res = await extractPackageFile(pipfile1, 'Pipfile');
      expect(res).toMatchSnapshot();
      expect(res.deps).toHaveLength(6);
      expect(res.deps.filter((dep) => !dep.skipReason)).toHaveLength(4);
    });
    it('marks packages with "extras" as skipReason === any-version', async () => {
      const res = await extractPackageFile(pipfile3, 'Pipfile');
      expect(res.deps.filter((r) => !r.skipReason)).toHaveLength(0);
      expect(res.deps.filter((r) => r.skipReason)).toHaveLength(6);
    });
    it('extracts multiple dependencies', async () => {
      const res = await extractPackageFile(pipfile2, 'Pipfile');
      expect(res).toMatchSnapshot();
      expect(res.deps).toHaveLength(5);
    });
    it('ignores git dependencies', async () => {
      const content =
        '[packages]\r\nflask = {git = "https://github.com/pallets/flask.git"}\r\nwerkzeug = ">=0.14"';
      const res = await extractPackageFile(content, 'Pipfile');
      expect(res.deps.filter((r) => !r.skipReason)).toHaveLength(1);
    });
    it('ignores invalid package names', async () => {
      const content = '[packages]\r\nfoo = "==1.0.0"\r\n_invalid = "==1.0.0"';
      const res = await extractPackageFile(content, 'Pipfile');
      expect(res.deps).toHaveLength(2);
      expect(res.deps.filter((dep) => !dep.skipReason)).toHaveLength(1);
    });
    it('ignores relative path dependencies', async () => {
      const content = '[packages]\r\nfoo = "==1.0.0"\r\ntest = {path = "."}';
      const res = await extractPackageFile(content, 'Pipfile');
      expect(res.deps.filter((r) => !r.skipReason)).toHaveLength(1);
    });
    it('ignores invalid versions', async () => {
      const content = '[packages]\r\nfoo = "==1.0.0"\r\nsome-package = "==0 0"';
      const res = await extractPackageFile(content, 'Pipfile');
      expect(res.deps).toHaveLength(2);
      expect(res.deps.filter((dep) => !dep.skipReason)).toHaveLength(1);
    });
    it('extracts all sources', async () => {
      const content =
        '[[source]]\r\nurl = "source-url"\r\n' +
        '[[source]]\r\nurl = "other-source-url"\r\n' +
        '[packages]\r\nfoo = "==1.0.0"\r\n';
      const res = await extractPackageFile(content, 'Pipfile');
      expect(res.registryUrls).toEqual(['source-url', 'other-source-url']);
    });
    it('extracts example pipfile', async () => {
      const res = await extractPackageFile(pipfile4, 'Pipfile');
      expect(res).toMatchSnapshot();
    });
    it('supports custom index', async () => {
      const res = await extractPackageFile(pipfile5, 'Pipfile');
      expect(res).toMatchSnapshot();
      expect(res.registryUrls).toBeDefined();
      expect(res.registryUrls).toHaveLength(2);
      expect(res.deps[0].registryUrls).toBeDefined();
      expect(res.deps[0].registryUrls).toHaveLength(1);
    });
    it('gets python constraint from python_version', async () => {
      const content =
        '[packages]\r\nfoo = "==1.0.0"\r\n' +
        '[requires]\r\npython_version = "3.8"';
      const res = await extractPackageFile(content, 'Pipfile');
      expect(res.constraints.python).toEqual('== 3.8.*');
    });
    it('gets python constraint from python_full_version', async () => {
      const content =
        '[packages]\r\nfoo = "==1.0.0"\r\n' +
        '[requires]\r\npython_full_version = "3.8.6"';
      const res = await extractPackageFile(content, 'Pipfile');
      expect(res.constraints.python).toEqual('== 3.8.6');
    });
    it('gets pipenv constraint from packages', async () => {
      const content = '[packages]\r\npipenv = "==2020.8.13"';
      const res = await extractPackageFile(content, 'Pipfile');
      expect(res.constraints.pipenv).toEqual('==2020.8.13');
    });
    it('gets pipenv constraint from dev-packages', async () => {
      const content = '[dev-packages]\r\npipenv = "==2020.8.13"';
      const res = await extractPackageFile(content, 'Pipfile');
      expect(res.constraints.pipenv).toEqual('==2020.8.13');
    });
  });
});
