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

    it('doesnt replace in registryUrls when not present', () => {
      const dep = partial<PackageDependency>({
        registryUrls: ['https://foo.example.com/bar'],
      });
      utils.substituteRegistryAliases(dep, {
        'https://replace.example.com': 'https://bar.example.com',
      });
      expect(dep.registryUrls).toEqual(['https://foo.example.com/bar']);
    });

    it('replaces in packageName when registryUrls absent', () => {
      const dep = partial<PackageDependency>({
        packageName: 'foo/bar',
      });
      utils.substituteRegistryAliases(dep, { foo: 'baz' });
      expect(dep.packageName).toBe('baz/bar');
    });

    it('doesnt replace packageName when not matching', () => {
      const dep = partial<PackageDependency>({
        packageName: 'foo/bar',
      });
      utils.substituteRegistryAliases(dep, { abc: 'def' });
      expect(dep.packageName).toBe('foo/bar');
    });

    it('doesnt replace depName when not matching', () => {
      const dep = partial<PackageDependency>({
        depName: 'foo/bar',
      });
      utils.substituteRegistryAliases(dep, { abc: 'def' });
      expect(dep.packageName).toBe(undefined);
    });

    it('creates packageName from depName when neither registryUrls nor packageName present', () => {
      const dep = partial<PackageDependency>({
        depName: 'foo/bar',
      });
      utils.substituteRegistryAliases(dep, { foo: 'baz' });
      expect(dep.packageName).toBe('baz/bar');
    });

    it('replaces original length instead of replacement length', () => {
      const dep = partial<PackageDependency>({
        depName: 'short/bar',
      });
      utils.substituteRegistryAliases(dep, { short: 'longer' });
      expect(dep.packageName).toBe('longer/bar');
    });

    it('only replaces a single alias', () => {
      const dep = partial<PackageDependency>({
        depName: 'a',
      });
      utils.substituteRegistryAliases(dep, { a: 'b', b: 'c' });
      expect(dep.packageName).toBe('b');
    });

    it('does nothing when registryUrls, packageName and depName are all absent', () => {
      const dep = partial<PackageDependency>({});
      utils.substituteRegistryAliases(dep, { foo: 'baz' });
      expect(dep.packageName).toBeUndefined();
      expect(dep.registryUrls).toBeUndefined();
    });
  });
});
