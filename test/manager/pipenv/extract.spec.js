const fs = require('fs');
const { extractPackageFile } = require('../../../lib/manager/pipenv/extract');

const pipfile1 = fs.readFileSync('test/_fixtures/pipenv/Pipfile1', 'utf8');
const pipfile2 = fs.readFileSync('test/_fixtures/pipenv/Pipfile2', 'utf8');

describe('lib/manager/pipenv/extract', () => {
  describe('extractPackageFile()', () => {
    let config;
    beforeEach(() => {
      config = {};
    });
    it('returns null for empty', () => {
      expect(extractPackageFile('[packages]\r\n', config)).toBe(null);
    });
    it('returns null for invalid toml file', () => {
      expect(extractPackageFile('nothing here', config)).toBe(null);
    });
    it('extracts dependencies', () => {
      const res = extractPackageFile(pipfile1, config).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(4);
    });
    it('extracts multiple dependencies', () => {
      const res = extractPackageFile(pipfile2, config).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(5);
    });
    it('ignores invalid package names', () => {
      const content = '[packages]\r\nfoo = "==1.0.0"\r\n_invalid = "==1.0.0"';
      const res = extractPackageFile(content, config).deps;
      expect(res).toHaveLength(1);
    });
    it('ignores invalid versions', () => {
      const content = '[packages]\r\nfoo = "==1.0.0"\r\nsome-package = "==0 0"';
      const res = extractPackageFile(content, config).deps;
      expect(res).toHaveLength(1);
    });
    it('extracts all sources', () => {
      const content =
        '[[source]]\r\nurl = "source-url"\r\n' +
        '[[source]]\r\nurl = "other-source-url"\r\n' +
        '[packages]\r\nfoo = "==1.0.0"\r\n';
      const res = extractPackageFile(content, config).deps;
      expect(res[0].registryUrls).toEqual(['source-url', 'other-source-url']);
    });
    it('converts simple-API URLs to JSON-API URLs', () => {
      const content =
        '[[source]]\r\nurl = "https://my-pypi/foo/simple/"\r\n' +
        '[[source]]\r\nurl = "https://other-pypi/foo/simple"\r\n' +
        '[packages]\r\nfoo = "==1.0.0"\r\n';
      const res = extractPackageFile(content, config).deps;
      expect(res[0].registryUrls).toEqual([
        'https://my-pypi/foo/pypi/',
        'https://other-pypi/foo/pypi/',
      ]);
    });
  });
});
