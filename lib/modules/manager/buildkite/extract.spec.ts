import { Fixtures } from '../../../../test/fixtures';
import type { PackageDependency } from '../types';
import { extractPackageFile } from '.';

describe('modules/manager/buildkite/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });

    it('extracts simple single plugin', () => {
      const res = extractPackageFile(Fixtures.get('pipeline1.yml'))?.deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
    });

    it('extracts multiple plugins in same file', () => {
      const res = extractPackageFile(Fixtures.get('pipeline2.yml'))?.deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(2);
    });

    it('adds skipReason', () => {
      const res = extractPackageFile(Fixtures.get('pipeline3.yml'))?.deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(2);
    });

    it('extracts arrays of plugins', () => {
      const res = extractPackageFile(Fixtures.get('pipeline4.yml'))?.deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(4);
    });

    it('extracts git-based plugins', () => {
      const res = extractPackageFile(Fixtures.get('pipeline5.yml'))?.deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(2);
    });

    it('extracts git-based plugin with .git at the end of its name', () => {
      const expectedPackageDependency: PackageDependency = {
        currentValue: 'v3.2.7',
        datasource: 'github-tags',
        depName: 'some-org/some-plugin',
        registryUrls: ['https://github.company.com'],
      };
      const res = extractPackageFile(Fixtures.get('pipeline6.yml'))?.deps;
      expect(res).toHaveLength(1);
      expect(res).toEqual([expectedPackageDependency]);
    });

    it('extracts plugins outside plugins sections', () => {
      const res = extractPackageFile(Fixtures.get('pipeline7.yml'))?.deps;
      const expectedPackageDependency: PackageDependency = {
        currentValue: 'v3.2.7',
        datasource: 'github-tags',
        depName: 'some-org/some-plugin',
        registryUrls: ['https://github.some-domain.com'],
      };
      expect(res).toEqual([expectedPackageDependency]);
    });

    it('extracts plugin with preceding ?', () => {
      const res = extractPackageFile(Fixtures.get('pipeline8.yml'))?.deps;
      const expectedPackageDependency: PackageDependency = {
        currentValue: 'v3.2.7',
        datasource: 'github-tags',
        depName: 'some-org/some-plugin',
        registryUrls: ['https://github.company.com'],
      };
      expect(res).toEqual([expectedPackageDependency]);
    });
  });
});
