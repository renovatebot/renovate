import { readFileSync } from 'fs';
import { parse } from '@iarna/toml';
import { add } from '../../util/host-rules';
import { extractPackageFile, extractRegistries } from './extract';

const pyproject1toml = readFileSync(
  'lib/manager/poetry/__fixtures__/pyproject.1.toml',
  'utf8'
);

const pyproject2toml = readFileSync(
  'lib/manager/poetry/__fixtures__/pyproject.2.toml',
  'utf8'
);

const pyproject3toml = readFileSync(
  'lib/manager/poetry/__fixtures__/pyproject.3.toml',
  'utf8'
);

const pyproject4toml = readFileSync(
  'lib/manager/poetry/__fixtures__/pyproject.4.toml',
  'utf8'
);

const pyproject5toml = readFileSync(
  'lib/manager/poetry/__fixtures__/pyproject.5.toml',
  'utf8'
);

const pyproject6toml = readFileSync(
  'lib/manager/poetry/__fixtures__/pyproject.6.toml',
  'utf8'
);

const pyproject7toml = readFileSync(
  'lib/manager/poetry/__fixtures__/pyproject.7.toml',
  'utf8'
);

const pyproject8toml = readFileSync(
  'lib/manager/poetry/__fixtures__/pyproject.8.toml',
  'utf8'
);

const pyproject9toml = readFileSync(
  'lib/manager/poetry/__fixtures__/pyproject.9.toml',
  'utf8'
);

describe('lib/manager/poetry/extract', () => {
  describe('extractPackageFile()', () => {
    let filename: string;
    const OLD_ENV = process.env;
    beforeEach(() => {
      filename = '';
      process.env = { ...OLD_ENV };
      delete process.env.PIP_INDEX_URL;
    });
    afterEach(() => {
      process.env = OLD_ENV;
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
      expect(res.constraints).toEqual({
        poetry: 'poetry>=1.0 wheel',
        python: '~2.7 || ^3.4',
      });
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
    it('extracts mixed versioning types', () => {
      const res = extractPackageFile(pyproject9toml, filename);
      expect(res).toMatchSnapshot();
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
    it('skips git dependencies with version', () => {
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
    it('skips path dependencies with version', () => {
      const content =
        '[tool.poetry.dependencies]\r\nflask = {path = "/some/path/", version = "1.2.3"}\r\nwerkzeug = ">=0.14"';
      const res = extractPackageFile(content, filename).deps;
      expect(res[0].depName).toBe('flask');
      expect(res[0].currentValue).toBe('1.2.3');
      expect(res[0].skipReason).toBe('path-dependency');
      expect(res).toHaveLength(2);
    });
  });

  describe('extractRegistries()', () => {
    it('supports authenticated registries via hostRules', () => {
      add({ hostName: 'pypi.fury.io', username: 'itsasecret' });
      const pyprojectfile = parse(
        '[[tool.poetry.source]]\r\nname = "fury"\r\nurl = "https://pypi.fury.io/renovate/"'
      );
      const res = extractRegistries(pyprojectfile);
      expect(res[0]).toBe('https://itsasecret:@pypi.fury.io/renovate/');
      expect(res).toHaveLength(2);
    });
  });
});
