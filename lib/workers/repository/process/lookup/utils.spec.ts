import type { LookupUpdate } from '../../../../modules/manager/types.ts';
import type { LookupUpdateConfig } from './types.ts';
import {
  determineNewReplacementName,
  resolveReplacementNameForAliases,
  stripNoopUpdates,
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

  describe('stripNoopUpdates()', () => {
    it('keeps updates which change the value', () => {
      const updates: LookupUpdate[] = [{ newValue: '1.1.0' }];

      expect(stripNoopUpdates(lookupConfig, updates)).toEqual(updates);
    });

    it('strips updates which change nothing', () => {
      const updates: LookupUpdate[] = [
        { newValue: '1.0.0' },
        { newValue: null as never },
        { newDigest: null, newValue: '1.1.0' },
      ];

      expect(stripNoopUpdates(lookupConfig, updates)).toBeEmptyArray();
    });

    it('keeps renames, replacements and lockfile updates', () => {
      const updates: LookupUpdate[] = [
        { newName: 'c', newValue: '1.0.0' },
        { isReplacement: true, newValue: '1.0.0' },
        { isLockfileUpdate: true, newValue: '1.0.0' },
      ];

      expect(stripNoopUpdates(lookupConfig, updates)).toEqual(updates);
    });

    it('keeps updates which only change the digest', () => {
      const config = { ...lookupConfig, currentDigest: 'aaa' };
      const updates: LookupUpdate[] = [
        { newValue: '1.0.0', newDigest: 'bbb' },
        { newValue: '1.0.0', newDigest: 'aaa' },
      ];

      expect(stripNoopUpdates(config, updates)).toEqual([
        { newValue: '1.0.0', newDigest: 'bbb' },
      ]);
    });

    it('strips value changes for rangeStrategy=in-range-only', () => {
      const config = {
        ...lookupConfig,
        rangeStrategy: 'in-range-only' as const,
        currentDigest: 'aaa',
      };
      const updates: LookupUpdate[] = [
        { newValue: '1.1.0' },
        { newValue: '1.0.0', newDigest: 'bbb' },
      ];

      expect(stripNoopUpdates(config, updates)).toEqual([
        { newValue: '1.0.0', newDigest: 'bbb' },
      ]);
    });

    it('strips rollbacks when followTag is combined with rollbackPrs', () => {
      const config = {
        ...lookupConfig,
        followTag: 'next',
        rollbackPrs: true,
      };
      const updates: LookupUpdate[] = [
        { updateType: 'rollback', newValue: '0.9.0' },
        { newValue: '1.1.0' },
      ];

      expect(stripNoopUpdates(config, updates)).toEqual([
        { newValue: '1.1.0' },
      ]);
    });

    it('keeps a lone rollback when followTag is combined with rollbackPrs', () => {
      const config = {
        ...lookupConfig,
        followTag: 'next',
        rollbackPrs: true,
      };
      const updates: LookupUpdate[] = [
        { updateType: 'rollback', newValue: '0.9.0' },
      ];

      expect(stripNoopUpdates(config, updates)).toEqual(updates);
    });
  });
});
