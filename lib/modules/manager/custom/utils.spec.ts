import { partial } from '~test/util.ts';
import type { PackageDependency } from '../types.ts';
import * as utils from './utils.ts';

describe('modules/manager/custom/utils', () => {
  describe('substituteRegistryAliases', () => {
    it('replaces in registryUrls when present', () => {
      const dep = partial<PackageDependency>({
        registryUrls: ['https://foo.example.com/bar'],
      });
      utils.substituteRegistryAliases(dep, {
        'https://foo.example.com': 'https://bar.example.com',
      });
      expect(dep.registryUrls).toEqual(['https://bar.example.com/bar']);
    });

    it('replaces in packageName when registryUrls absent', () => {
      const dep = partial<PackageDependency>({
        packageName: 'foo/bar',
      });
      utils.substituteRegistryAliases(dep, { foo: 'baz' });
      expect(dep.packageName).toBe('baz/bar');
    });

    it('creates packageName from depName when neither registryUrls nor packageName present', () => {
      const dep = partial<PackageDependency>({
        depName: 'foo/bar',
      });
      utils.substituteRegistryAliases(dep, { foo: 'baz' });
      expect(dep.packageName).toBe('baz/bar');
    });

    it('does nothing when registryUrls, packageName and depName are all absent', () => {
      const dep = partial<PackageDependency>({});
      utils.substituteRegistryAliases(dep, { foo: 'baz' });
      expect(dep.packageName).toBeUndefined();
      expect(dep.registryUrls).toBeUndefined();
    });
  });
});
