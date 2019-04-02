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
      const res = extractPackageFile(pipfile1, config).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(4);
    });
    it('extracts multiple dependencies', () => {
      const res = extractPackageFile(pipfile2, config).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(5);
    });
    it('ignores git dependencies', () => {
      const content =
        '[packages]\r\nflask = {git = "https://github.com/pallets/flask.git"}\r\nwerkzeug = ">=0.14"';
      const res = extractPackageFile(content, config).deps;
      expect(res).toHaveLength(1);
    });
    it('ignores invalid package names', () => {
      const content = '[packages]\r\nfoo = "==1.0.0"\r\n_invalid = "==1.0.0"';
      const res = extractPackageFile(content, config).deps;
      expect(res).toHaveLength(1);
    });
    it('ignores relative path dependencies', () => {
      const content = '[packages]\r\nfoo = "==1.0.0"\r\ntest = {path = "."}';
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
  });
});
