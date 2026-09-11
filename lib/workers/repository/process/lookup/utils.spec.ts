import type { LookupUpdateConfig } from './types.ts';
import {
  determineNewReplacementName,
  resolveReplacementNameForAliases,
} from './utils.ts';

const lookupConfig: LookupUpdateConfig = {
  datasource: 'npm',
  packageName: 'b',
  currentValue: '1.0.0',
  versioning: 'semver',
  rangeStrategy: 'replace',
};

describe('workers/repository/process/lookup/utils', () => {
  describe('determineNewReplacementName()', () => {
    it('returns the replacement name if defined', () => {
      expect(
        determineNewReplacementName({
          ...lookupConfig,
          replacementName: 'foo',
        }),
      ).toBe('foo');
    });

    it('returns the replacement name template if defined', () => {
      expect(
        determineNewReplacementName({
          ...lookupConfig,
          replacementNameTemplate: 'foo',
        }),
      ).toBe('foo');
    });

    it('returns the package name if defined', () => {
      expect(determineNewReplacementName(lookupConfig)).toBe('b');
    });
  });

  describe('resolveReplacementNameForAliases()', () => {
    it('returns undefined unchanged', () => {
      expect(
        resolveReplacementNameForAliases(undefined, {
          jfrogecosystem: 'some.jfrog.mirror',
        }),
      ).toBeUndefined();
    });

    it('returns the replacement name unchanged when no registryAliases are configured', () => {
      expect(
        resolveReplacementNameForAliases('$CI_REGISTRY/foo/bar', undefined),
      ).toBe('$CI_REGISTRY/foo/bar');
    });

    it('returns the replacement name unchanged when no alias matches', () => {
      expect(
        resolveReplacementNameForAliases('foo/bar', {
          jfrogecosystem: 'some.jfrog.mirror',
        }),
      ).toBe('foo/bar');
    });

    it('resolves a matching prefix alias', () => {
      expect(
        resolveReplacementNameForAliases('$CI_REGISTRY/foo/bar', {
          $CI_REGISTRY: 'registry.example.com',
        }),
      ).toBe('registry.example.com/foo/bar');
    });

    it('does not resolve a bare alias with no trailing path', () => {
      expect(
        resolveReplacementNameForAliases('jfrogecosystem', {
          jfrogecosystem: 'some.jfrog.mirror',
        }),
      ).toBe('jfrogecosystem');
    });

    it('does not partially match an alias that is a substring of another segment', () => {
      expect(
        resolveReplacementNameForAliases('jfrogecosystem2/foo', {
          jfrogecosystem: 'some.jfrog.mirror',
        }),
      ).toBe('jfrogecosystem2/foo');
    });

    it('uses the first matching alias when multiple are configured', () => {
      expect(
        resolveReplacementNameForAliases('docker.io/library/redis', {
          'docker.io': 'harbor.example.com/docker.io',
          'docker.io/library': 'harbor.example.com/library-mirror',
        }),
      ).toBe('harbor.example.com/docker.io/library/redis');
    });
  });
});
