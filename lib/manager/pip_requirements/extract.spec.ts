import { readFileSync } from 'fs';
import { extractPackageFile } from './extract';

const requirements1 = readFileSync(
  'lib/manager/pip_requirements/__fixtures__/requirements1.txt',
  'utf8'
);
const requirements2 = readFileSync(
  'lib/manager/pip_requirements/__fixtures__/requirements2.txt',
  'utf8'
);
const requirements3 = readFileSync(
  'lib/manager/pip_requirements/__fixtures__/requirements3.txt',
  'utf8'
);

const requirements4 = readFileSync(
  'lib/manager/pip_requirements/__fixtures__/requirements4.txt',
  'utf8'
);

const requirements5 = readFileSync(
  'lib/manager/pip_requirements/__fixtures__/requirements5.txt',
  'utf8'
);

const requirements6 = readFileSync(
  'lib/manager/pip_requirements/__fixtures__/requirements6.txt',
  'utf8'
);

describe('lib/manager/pip_requirements/extract', () => {
  describe('extractPackageFile()', () => {
    let config;
    beforeEach(() => {
      config = { registryUrls: ['AnExistingDefaultUrl'] };
    });
    it('returns null for empty', () => {
      expect(
        extractPackageFile('nothing here', 'requirements.txt', config)
      ).toBeNull();
    });
    it('extracts dependencies', () => {
      const res = extractPackageFile(requirements1, 'unused_file_name', config);
      expect(res).toMatchSnapshot();
      expect(res.registryUrls).toEqual(['http://example.com/private-pypi/']);
      expect(res.deps).toHaveLength(3);
    });
    it('extracts multiple dependencies', () => {
      const res = extractPackageFile(requirements2, 'unused_file_name', config)
        .deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(5);
    });
    it('handles comments and commands', () => {
      const res = extractPackageFile(requirements3, 'unused_file_name', config)
        .deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(5);
    });
    it('handles extras and complex index url', () => {
      const res = extractPackageFile(requirements4, 'unused_file_name', config);
      expect(res).toMatchSnapshot();
      expect(res.registryUrls).toEqual([
        'https://artifactory.company.com/artifactory/api/pypi/python/simple',
      ]);
      expect(res.deps).toHaveLength(3);
    });
    it('handles extra index url', () => {
      const res = extractPackageFile(requirements5, 'unused_file_name', config);
      expect(res).toMatchSnapshot();
      expect(res.registryUrls).toEqual([
        'https://artifactory.company.com/artifactory/api/pypi/python/simple',
        'http://example.com/private-pypi/',
      ]);
      expect(res.deps).toHaveLength(6);
    });
    it('handles extra index url and defaults without index to config', () => {
      const res = extractPackageFile(requirements6, 'unused_file_name', config);
      expect(res).toMatchSnapshot();
      expect(res.registryUrls).toEqual([
        'AnExistingDefaultUrl',
        'http://example.com/private-pypi/',
      ]);
      expect(res.deps).toHaveLength(6);
    });
    it('handles extra index url and defaults without index to pypi', () => {
      const res = extractPackageFile(requirements6, 'unused_file_name', {});
      expect(res).toMatchSnapshot();
      expect(res.registryUrls).toEqual([
        'https://pypi.org/pypi/',
        'http://example.com/private-pypi/',
      ]);
      expect(res.deps).toHaveLength(6);
    });
  });
});
