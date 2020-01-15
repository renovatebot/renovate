import fs from 'fs';
import { extractPackageFile } from '../../../lib/manager/pipenv/extract';

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
const pipfile5 = fs.readFileSync(
  'test/manager/pipenv/_fixtures/Pipfile5',
  'utf8'
);

describe('lib/manager/pipenv/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile({ fileContent: '[packages]\r\n' })).toBeNull();
    });
    it('returns null for invalid toml file', () => {
      expect(extractPackageFile({ fileContent: 'nothing here' })).toBeNull();
    });
    it('extracts dependencies', () => {
      const res = extractPackageFile({ fileContent: pipfile1 });
      expect(res).toMatchSnapshot();
      expect(res.deps).toHaveLength(6);
      expect(res.deps.filter(dep => !dep.skipReason)).toHaveLength(4);
    });
    it('marks packages with "extras" as skipReason === any-version', () => {
      const res = extractPackageFile({ fileContent: pipfile3 });
      expect(res.deps.filter(r => !r.skipReason)).toHaveLength(0);
      expect(res.deps.filter(r => r.skipReason)).toHaveLength(6);
    });
    it('extracts multiple dependencies', () => {
      const res = extractPackageFile({ fileContent: pipfile2 });
      expect(res).toMatchSnapshot();
      expect(res.deps).toHaveLength(5);
    });
    it('ignores git dependencies', () => {
      const fileContent =
        '[packages]\r\nflask = {git = "https://github.com/pallets/flask.git"}\r\nwerkzeug = ">=0.14"';
      const res = extractPackageFile({ fileContent });
      expect(res.deps.filter(r => !r.skipReason)).toHaveLength(1);
    });
    it('ignores invalid package names', () => {
      const fileContent =
        '[packages]\r\nfoo = "==1.0.0"\r\n_invalid = "==1.0.0"';
      const res = extractPackageFile({ fileContent });
      expect(res.deps).toHaveLength(2);
      expect(res.deps.filter(dep => !dep.skipReason)).toHaveLength(1);
    });
    it('ignores relative path dependencies', () => {
      const fileContent =
        '[packages]\r\nfoo = "==1.0.0"\r\ntest = {path = "."}';
      const res = extractPackageFile({ fileContent });
      expect(res.deps.filter(r => !r.skipReason)).toHaveLength(1);
    });
    it('ignores invalid versions', () => {
      const fileContent =
        '[packages]\r\nfoo = "==1.0.0"\r\nsome-package = "==0 0"';
      const res = extractPackageFile({ fileContent });
      expect(res.deps).toHaveLength(2);
      expect(res.deps.filter(dep => !dep.skipReason)).toHaveLength(1);
    });
    it('extracts all sources', () => {
      const fileContent =
        '[[source]]\r\nurl = "source-url"\r\n' +
        '[[source]]\r\nurl = "other-source-url"\r\n' +
        '[packages]\r\nfoo = "==1.0.0"\r\n';
      const res = extractPackageFile({ fileContent });
      expect(res.registryUrls).toEqual(['source-url', 'other-source-url']);
    });
    it('extracts example pipfile', () => {
      const res = extractPackageFile({ fileContent: pipfile4 });
      expect(res).toMatchSnapshot();
    });
    it('supports custom index', () => {
      const res = extractPackageFile({ fileContent: pipfile5 });
      expect(res).toMatchSnapshot();
      expect(res.registryUrls).toBeDefined();
      expect(res.registryUrls).toHaveLength(2);
      expect(res.deps[0].registryUrls).toBeDefined();
      expect(res.deps[0].registryUrls).toHaveLength(1);
    });
  });
});
