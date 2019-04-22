const fs = require('fs');
const { extractPackageFile } = require('../../../lib/manager/pipenv/extract');

const pipfile1 = fs.readFileSync(
  'test/manager/pipenv/_fixtures/Pipfile1',
  'utf8'
);
const pipfile2 = fs.readFileSync(
  'test/manager/pipenv/_fixtures/Pipfile2',
  'utf8'
);
const pipfile3 = fs.readFileSync(
  'test/manager/pipenv/_fixtures/Pipfile3',
  'utf8'
);
const pipfile4 = fs.readFileSync(
  'test/manager/pipenv/_fixtures/Pipfile4',
  'utf8'
);

describe('lib/manager/pipenv/extract', () => {
  describe('extractPackageFile()', () => {
    let config;
    beforeEach(() => {
      config = {};
    });
    it('returns null for empty', () => {
      expect(extractPackageFile('[packages]\r\n', config)).toBeNull();
    });
    it('returns null for invalid toml file', () => {
      expect(extractPackageFile('nothing here', config)).toBeNull();
    });
    it('extracts dependencies', () => {
      const res = extractPackageFile(pipfile1, config);
      expect(res).toMatchSnapshot();
      expect(res.deps).toHaveLength(6);
      expect(res.deps.filter(dep => !dep.skipReason)).toHaveLength(4);
    });
    it('marks packages with "extras" as skipReason === any-version', () => {
      const res = extractPackageFile(pipfile3, {
        extends: ['config:base'],
        pipenv: { enabled: true },
        pip_setup: { enabled: true },
        labels: ['dependencies'],
      });
      expect(res.deps.filter(r => !r.skipReason)).toHaveLength(0);
      expect(res.deps.filter(r => r.skipReason)).toHaveLength(6);
    });
    it('extracts multiple dependencies', () => {
      const res = extractPackageFile(pipfile2, config);
      expect(res).toMatchSnapshot();
      expect(res.deps).toHaveLength(5);
    });
    it('ignores git dependencies', () => {
      const content =
        '[packages]\r\nflask = {git = "https://github.com/pallets/flask.git"}\r\nwerkzeug = ">=0.14"';
      const res = extractPackageFile(content, config);
      expect(res.deps.filter(r => !r.skipReason)).toHaveLength(1);
    });
    it('ignores invalid package names', () => {
      const content = '[packages]\r\nfoo = "==1.0.0"\r\n_invalid = "==1.0.0"';
      const res = extractPackageFile(content, config);
      expect(res.deps).toHaveLength(2);
      expect(res.deps.filter(dep => !dep.skipReason)).toHaveLength(1);
    });
    it('ignores relative path dependencies', () => {
      const content = '[packages]\r\nfoo = "==1.0.0"\r\ntest = {path = "."}';
      const res = extractPackageFile(content, config);
      expect(res.deps.filter(r => !r.skipReason)).toHaveLength(1);
    });
    it('ignores invalid versions', () => {
      const content = '[packages]\r\nfoo = "==1.0.0"\r\nsome-package = "==0 0"';
      const res = extractPackageFile(content, config);
      expect(res.deps).toHaveLength(2);
      expect(res.deps.filter(dep => !dep.skipReason)).toHaveLength(1);
    });
    it('extracts all sources', () => {
      const content =
        '[[source]]\r\nurl = "source-url"\r\n' +
        '[[source]]\r\nurl = "other-source-url"\r\n' +
        '[packages]\r\nfoo = "==1.0.0"\r\n';
      const res = extractPackageFile(content, config);
      expect(res.registryUrls).toEqual(['source-url', 'other-source-url']);
    });
    it('extracts example pipfile', () => {
      const res = extractPackageFile(pipfile4, config);
      expect(res).toMatchSnapshot();
    });
  });
});
