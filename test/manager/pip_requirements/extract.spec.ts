import { readFileSync } from 'fs';
import { extractPackageFile } from '../../../lib/manager/pip_requirements/extract';

const requirements1 = readFileSync(
  'test/manager/pip_requirements/_fixtures/requirements1.txt',
  'utf8'
);
const requirements2 = readFileSync(
  'test/manager/pip_requirements/_fixtures/requirements2.txt',
  'utf8'
);
const requirements3 = readFileSync(
  'test/manager/pip_requirements/_fixtures/requirements3.txt',
  'utf8'
);

const requirements4 = readFileSync(
  'test/manager/pip_requirements/_fixtures/requirements4.txt',
  'utf8'
);

const requirements5 = readFileSync(
  'test/manager/pip_requirements/_fixtures/requirements5.txt',
  'utf8'
);

const requirements6 = readFileSync(
  'test/manager/pip_requirements/_fixtures/requirements6.txt',
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
        extractPackageFile({
          fileContent: 'nothing here',
          fileName: 'requirements.txt',
          config,
        })
      ).toBeNull();
    });
    it('extracts dependencies', () => {
      const res = extractPackageFile({
        fileContent: requirements1,
        fileName: 'unused_file_name',
        config,
      });
      expect(res).toMatchSnapshot();
      expect(res.registryUrls).toEqual(['http://example.com/private-pypi/']);
      expect(res.deps).toHaveLength(3);
    });
    it('extracts multiple dependencies', () => {
      const res = extractPackageFile({
        fileContent: requirements2,
        fileName: 'unused_file_name',
        config,
      }).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(5);
    });
    it('handles comments and commands', () => {
      const res = extractPackageFile({
        fileContent: requirements3,
        fileName: 'unused_file_name',
        config,
      }).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(5);
    });
    it('handles extras and complex index url', () => {
      const res = extractPackageFile({
        fileContent: requirements4,
        fileName: 'unused_file_name',
        config,
      });
      expect(res).toMatchSnapshot();
      expect(res.registryUrls).toEqual([
        'https://artifactory.company.com/artifactory/api/pypi/python/simple',
      ]);
      expect(res.deps).toHaveLength(3);
    });
    it('handles extra index url', () => {
      const res = extractPackageFile({
        fileContent: requirements5,
        fileName: 'unused_file_name',
        config,
      });
      expect(res).toMatchSnapshot();
      expect(res.registryUrls).toEqual([
        'https://artifactory.company.com/artifactory/api/pypi/python/simple',
        'http://example.com/private-pypi/',
      ]);
      expect(res.deps).toHaveLength(6);
    });
    it('handles extra index url and defaults without index to config', () => {
      const res = extractPackageFile({
        fileContent: requirements6,
        fileName: 'unused_file_name',
        config,
      });
      expect(res).toMatchSnapshot();
      expect(res.registryUrls).toEqual([
        'AnExistingDefaultUrl',
        'http://example.com/private-pypi/',
      ]);
      expect(res.deps).toHaveLength(6);
    });
    it('handles extra index url and defaults without index to pypi', () => {
      const res = extractPackageFile({
        fileContent: requirements6,
        fileName: 'unused_file_name',
        config: {},
      });
      expect(res).toMatchSnapshot();
      expect(res.registryUrls).toEqual([
        'https://pypi.org/pypi/',
        'http://example.com/private-pypi/',
      ]);
      expect(res.deps).toHaveLength(6);
    });
  });
});
