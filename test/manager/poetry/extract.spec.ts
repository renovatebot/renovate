import { readFileSync } from 'fs';
import { extractPackageFile } from '../../../lib/manager/poetry/extract';

const pyproject1toml = readFileSync(
  'test/manager/poetry/_fixtures/pyproject.1.toml',
  'utf8'
);

const pyproject2toml = readFileSync(
  'test/manager/poetry/_fixtures/pyproject.2.toml',
  'utf8'
);

const pyproject3toml = readFileSync(
  'test/manager/poetry/_fixtures/pyproject.3.toml',
  'utf8'
);

const pyproject4toml = readFileSync(
  'test/manager/poetry/_fixtures/pyproject.4.toml',
  'utf8'
);

const pyproject5toml = readFileSync(
  'test/manager/poetry/_fixtures/pyproject.5.toml',
  'utf8'
);

const pyproject6toml = readFileSync(
  'test/manager/poetry/_fixtures/pyproject.6.toml',
  'utf8'
);

const pyproject7toml = readFileSync(
  'test/manager/poetry/_fixtures/pyproject.7.toml',
  'utf8'
);

const pyproject8toml = readFileSync(
  'test/manager/poetry/_fixtures/pyproject.8.toml',
  'utf8'
);

describe('lib/manager/poetry/extract', () => {
  describe('extractPackageFile()', () => {
    let filename: string;
    beforeEach(() => {
      filename = '';
    });
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here', filename)).toBeNull();
    });
    it('returns null for parsed file without poetry section', () => {
      expect(extractPackageFile(pyproject5toml, filename)).toBeNull();
    });
    it('extracts multiple dependencies', () => {
      const res = extractPackageFile(pyproject1toml, filename);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(9);
    });
    it('extracts multiple dependencies (with dep = {version = "1.2.3"} case)', () => {
      const res = extractPackageFile(pyproject2toml, filename);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(7);
    });
    it('handles case with no dependencies', () => {
      const res = extractPackageFile(pyproject3toml, filename);
      expect(res).toBeNull();
    });
    it('handles multiple constraint dependencies', () => {
      const res = extractPackageFile(pyproject4toml, filename);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(1);
    });
    it('extracts registries', () => {
      const res = extractPackageFile(pyproject6toml, filename);
      expect(res.registryUrls).toMatchSnapshot();
      expect(res.registryUrls).toHaveLength(3);
    });
    it('can parse empty registries', () => {
      const res = extractPackageFile(pyproject7toml, filename);
      expect(res.registryUrls).toBeNull();
    });
    it('can parse missing registries', () => {
      const res = extractPackageFile(pyproject1toml, filename);
      expect(res.registryUrls).toBeNull();
    });
    it('dedupes registries', () => {
      const res = extractPackageFile(pyproject8toml, filename);
      expect(res.registryUrls).toMatchSnapshot();
    });
    it('skips git dependencies', () => {
      const content =
        '[tool.poetry.dependencies]\r\nflask = {git = "https://github.com/pallets/flask.git"}\r\nwerkzeug = ">=0.14"';
      const res = extractPackageFile(content, filename).deps;
      expect(res[0].depName).toBe('flask');
      expect(res[0].currentValue).toBe('');
      expect(res[0].skipReason).toBe('git-dependency');
      expect(res).toHaveLength(2);
    });
    it('skips git dependencies', () => {
      const content =
        '[tool.poetry.dependencies]\r\nflask = {git = "https://github.com/pallets/flask.git", version="1.2.3"}\r\nwerkzeug = ">=0.14"';
      const res = extractPackageFile(content, filename).deps;
      expect(res[0].depName).toBe('flask');
      expect(res[0].currentValue).toBe('1.2.3');
      expect(res[0].skipReason).toBe('git-dependency');
      expect(res).toHaveLength(2);
    });
    it('skips path dependencies', () => {
      const content =
        '[tool.poetry.dependencies]\r\nflask = {path = "/some/path/"}\r\nwerkzeug = ">=0.14"';
      const res = extractPackageFile(content, filename).deps;
      expect(res[0].depName).toBe('flask');
      expect(res[0].currentValue).toBe('');
      expect(res[0].skipReason).toBe('path-dependency');
      expect(res).toHaveLength(2);
    });
    it('skips path dependencies', () => {
      const content =
        '[tool.poetry.dependencies]\r\nflask = {path = "/some/path/", version = "1.2.3"}\r\nwerkzeug = ">=0.14"';
      const res = extractPackageFile(content, filename).deps;
      expect(res[0].depName).toBe('flask');
      expect(res[0].currentValue).toBe('1.2.3');
      expect(res[0].skipReason).toBe('path-dependency');
      expect(res).toHaveLength(2);
    });
  });
});
