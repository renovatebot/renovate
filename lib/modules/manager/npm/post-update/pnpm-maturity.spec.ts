import { codeBlock } from 'common-tags';
import { partial } from '~test/util.ts';
import type { Upgrade } from '../../types.ts';
import {
  appendPnpmMinimumReleaseAgeExcludeFlags,
  getPnpmWorkspaceMaturityExcludes,
  lockfileContainsPackageVersion,
  parsePnpmNoMatureMatchingVersion,
  parsePnpmNoMatureMatchingVersions,
  shouldExcludeImmatureVersionForLockfileRetry,
  toMinimumReleaseAgeExcludeEntry,
  withPnpmMaturityExcludes,
} from './pnpm-maturity.ts';

describe('modules/manager/npm/post-update/pnpm-maturity', () => {
  describe('parsePnpmNoMatureMatchingVersion', () => {
    it('returns null for empty input', () => {
      expect(parsePnpmNoMatureMatchingVersion(null)).toBeNull();
      expect(parsePnpmNoMatureMatchingVersion(undefined)).toBeNull();
      expect(parsePnpmNoMatureMatchingVersion('')).toBeNull();
    });

    it('returns null when error code is absent', () => {
      expect(
        parsePnpmNoMatureMatchingVersion(
          'ERR_PNPM_OUTDATED_LOCKFILE something',
        ),
      ).toBeNull();
    });

    it('parses scoped package from full Renovate/pnpm stderr', () => {
      const stderr = codeBlock`
        Scope: all 81 workspace projects
        Progress: resolved 1, reused 0, downloaded 0, added 0
        /tmp/renovate/repos/github/xai-org/xai/frontend/apps/cloud-console:
        ERR_PNPM_NO_MATURE_MATCHING_VERSION  Version 3.0.97 (released 2 days ago) of @ai-sdk/xai does not meet the minimumReleaseAge constraint

        This error happened while installing a direct dependency of /tmp/renovate/repos/github/xai-org/xai/frontend/apps/cloud-console

        The latest release of @ai-sdk/xai is "4.0.0". Published at 6/25/2026
      `;
      expect(parsePnpmNoMatureMatchingVersion(stderr)).toEqual({
        packageName: '@ai-sdk/xai',
        version: '3.0.97',
      });
    });

    it('parses unscoped package', () => {
      const stderr =
        'ERR_PNPM_NO_MATURE_MATCHING_VERSION  Version 1.2.3 (released 1 day ago) of lodash does not meet the minimumReleaseAge constraint';
      expect(parsePnpmNoMatureMatchingVersion(stderr)).toEqual({
        packageName: 'lodash',
        version: '1.2.3',
      });
    });

    it('parses prose-only line when code prefix is elsewhere', () => {
      const stderr = codeBlock`
        ERR_PNPM_NO_MATURE_MATCHING_VERSION
        Version 9.9.9 (released 0 minutes ago) of @scope/pkg does not meet the minimumReleaseAge constraint
      `;
      expect(parsePnpmNoMatureMatchingVersion(stderr)).toEqual({
        packageName: '@scope/pkg',
        version: '9.9.9',
      });
    });

    it('returns null when error code is present but version line is missing', () => {
      expect(
        parsePnpmNoMatureMatchingVersion(
          'ERR_PNPM_NO_MATURE_MATCHING_VERSION something went wrong',
        ),
      ).toBeNull();
    });

    it('parses all versions from pnpm list-style maturity errors', () => {
      const stderr = codeBlock`
        ERR_PNPM_NO_MATURE_MATCHING_VERSION  2 versions do not meet the minimumReleaseAge constraint:
          @ai-sdk/xai@3.0.97 was published at 2026-06-25T12:00:00.000Z, within the minimumReleaseAge cutoff (2026-06-20T12:00:00.000Z)
          lodash@4.17.21 was published at 2026-06-25T12:00:00.000Z, within the minimumReleaseAge cutoff (2026-06-20T12:00:00.000Z)
      `;
      expect(parsePnpmNoMatureMatchingVersions(stderr)).toEqual([
        { packageName: '@ai-sdk/xai', version: '3.0.97' },
        { packageName: 'lodash', version: '4.17.21' },
      ]);
    });

    it('deduplicates versions parsed from multiple maturity formats', () => {
      const stderr = codeBlock`
        ERR_PNPM_NO_MATURE_MATCHING_VERSION  Version 3.0.97 (released 2 days ago) of @ai-sdk/xai does not meet the minimumReleaseAge constraint
          @ai-sdk/xai@3.0.97 was published at 2026-06-25T12:00:00.000Z, within the minimumReleaseAge cutoff (2026-06-20T12:00:00.000Z)
      `;
      expect(parsePnpmNoMatureMatchingVersions(stderr)).toEqual([
        { packageName: '@ai-sdk/xai', version: '3.0.97' },
      ]);
    });
  });

  describe('lockfileContainsPackageVersion', () => {
    const lockfileV9 = codeBlock`
      lockfileVersion: '9.0'

      packages:
        '@ai-sdk/xai@3.0.97':
          resolution: {integrity: sha512-abc}
        lodash@4.17.21:
          resolution: {integrity: sha512-def}
    `;

    const lockfilePathStyle = codeBlock`
      lockfileVersion: 5.4

      packages:
        /@ai-sdk/xai@3.0.97(zod@4.3.6):
          resolution: {integrity: sha512-abc}
        /lodash@4.17.21:
          resolution: {integrity: sha512-def}
    `;

    it('returns false for missing lockfile or args', () => {
      expect(
        lockfileContainsPackageVersion(null, '@ai-sdk/xai', '3.0.97'),
      ).toBeFalse();
      expect(
        lockfileContainsPackageVersion(lockfileV9, '', '3.0.97'),
      ).toBeFalse();
      expect(
        lockfileContainsPackageVersion(lockfileV9, '@ai-sdk/xai', ''),
      ).toBeFalse();
    });

    it('detects scoped and unscoped keys in lockfile v9 style', () => {
      expect(
        lockfileContainsPackageVersion(lockfileV9, '@ai-sdk/xai', '3.0.97'),
      ).toBeTrue();
      expect(
        lockfileContainsPackageVersion(lockfileV9, 'lodash', '4.17.21'),
      ).toBeTrue();
      expect(
        lockfileContainsPackageVersion(lockfileV9, '@ai-sdk/xai', '3.0.98'),
      ).toBeFalse();
      expect(
        lockfileContainsPackageVersion(lockfileV9, 'react', '19.0.0'),
      ).toBeFalse();
    });

    it('detects double-quoted package keys', () => {
      const lockfile = codeBlock`
        packages:
          "@scope/pkg@1.2.3":
            resolution: {integrity: sha512-abc}
      `;
      expect(
        lockfileContainsPackageVersion(lockfile, '@scope/pkg', '1.2.3'),
      ).toBeTrue();
    });

    it('detects path-style lockfile package keys', () => {
      expect(
        lockfileContainsPackageVersion(
          lockfilePathStyle,
          '@ai-sdk/xai',
          '3.0.97',
        ),
      ).toBeTrue();
      expect(
        lockfileContainsPackageVersion(lockfilePathStyle, 'lodash', '4.17.21'),
      ).toBeTrue();
      expect(
        lockfileContainsPackageVersion(lockfilePathStyle, 'lodash', '4.17.20'),
      ).toBeFalse();
    });

    it('does not match package name alone without version key', () => {
      const onlyName =
        "importers:\n  apps/foo:\n    dependencies:\n      '@ai-sdk/xai':\n        version: 3.0.97\n";
      // Ambiguous importer form is intentionally not enough without packages key
      expect(
        lockfileContainsPackageVersion(onlyName, '@ai-sdk/xai', '3.0.97'),
      ).toBeFalse();
    });
  });

  describe('shouldExcludeImmatureVersionForLockfileRetry', () => {
    const lockfile = `packages:\n  '@ai-sdk/xai@3.0.97':\n    resolution: {integrity: x}\n`;

    it('allows exclude when version is already in pre-update lockfile', () => {
      expect(
        shouldExcludeImmatureVersionForLockfileRetry({
          packageName: '@ai-sdk/xai',
          version: '3.0.97',
          preUpdateLockfileContent: lockfile,
          upgrades: [],
        }),
      ).toBeTrue();
    });

    it('denies exclude for brand-new version not in lockfile', () => {
      expect(
        shouldExcludeImmatureVersionForLockfileRetry({
          packageName: '@ai-sdk/xai',
          version: '9.9.9',
          preUpdateLockfileContent: lockfile,
          upgrades: [partial<Upgrade>({ packageName: 'react-leaflet' })],
        }),
      ).toBeFalse();
    });

    it('allows exclude for security remediation target without lockfile entry', () => {
      expect(
        shouldExcludeImmatureVersionForLockfileRetry({
          packageName: 'ua-parser-js',
          version: '2.0.10',
          preUpdateLockfileContent: null,
          upgrades: [
            partial<Upgrade>({
              packageName: 'ua-parser-js',
              newVersion: '2.0.10',
              isVulnerabilityAlert: true,
            }),
          ],
        }),
      ).toBeTrue();
    });

    it('denies security upgrade for a different version', () => {
      expect(
        shouldExcludeImmatureVersionForLockfileRetry({
          packageName: 'ua-parser-js',
          version: '2.0.9',
          preUpdateLockfileContent: null,
          upgrades: [
            partial<Upgrade>({
              packageName: 'ua-parser-js',
              newVersion: '2.0.10',
              isVulnerabilityAlert: true,
            }),
          ],
        }),
      ).toBeFalse();
    });

    it('denies when lockfile is empty and not security', () => {
      expect(
        shouldExcludeImmatureVersionForLockfileRetry({
          packageName: 'lodash',
          version: '4.17.21',
          preUpdateLockfileContent: null,
          upgrades: [],
        }),
      ).toBeFalse();
    });

    it('matches security remediation via depName and newValue', () => {
      expect(
        shouldExcludeImmatureVersionForLockfileRetry({
          packageName: 'ua-parser-js',
          version: '2.0.10',
          preUpdateLockfileContent: null,
          upgrades: [
            partial<Upgrade>({
              depName: 'ua-parser-js',
              newValue: '2.0.10',
              isVulnerabilityAlert: true,
            }),
          ],
        }),
      ).toBeTrue();
    });

    it('skips non-matching vulnerability upgrades', () => {
      expect(
        shouldExcludeImmatureVersionForLockfileRetry({
          packageName: 'ua-parser-js',
          version: '2.0.10',
          preUpdateLockfileContent: null,
          upgrades: [
            partial<Upgrade>({
              packageName: 'other-pkg',
              newVersion: '2.0.10',
              isVulnerabilityAlert: true,
            }),
            partial<Upgrade>({
              packageName: 'ua-parser-js',
              newVersion: '2.0.10',
              isVulnerabilityAlert: false,
            }),
          ],
        }),
      ).toBeFalse();
    });
  });

  describe('CLI flag helpers', () => {
    it('builds exclude entry', () => {
      expect(toMinimumReleaseAgeExcludeEntry('@ai-sdk/xai', '3.0.97')).toBe(
        '@ai-sdk/xai@3.0.97',
      );
    });

    it('appends exclude flags with quoting for scoped packages', () => {
      const cmd = appendPnpmMinimumReleaseAgeExcludeFlags(
        'pnpm install --lockfile-only',
        ['@ai-sdk/xai@3.0.97', 'lodash@4.17.21'],
      );
      expect(cmd).toContain('pnpm install --lockfile-only');
      expect(cmd).toContain(
        '--config.minimumReleaseAgeExclude[]=@ai-sdk/xai@3.0.97',
      );
      expect(cmd).toContain(
        '--config.minimumReleaseAgeExclude[]=lodash@4.17.21',
      );
    });

    it('appendPnpmMinimumReleaseAgeExcludeFlags is no-op for empty excludes', () => {
      expect(appendPnpmMinimumReleaseAgeExcludeFlags('pnpm install', [])).toBe(
        'pnpm install',
      );
    });

    it('reads existing pnpm workspace maturity excludes', () => {
      expect(
        getPnpmWorkspaceMaturityExcludes({
          packages: ['apps/*'],
          minimumReleaseAgeExclude: ['existing@1.0.0', ''],
        }),
      ).toEqual(['existing@1.0.0']);
      expect(getPnpmWorkspaceMaturityExcludes(undefined)).toEqual([]);
    });

    it('withPnpmMaturityExcludes is no-op for empty excludes', () => {
      const commands = ['pnpm install --lockfile-only'];
      expect(withPnpmMaturityExcludes(commands, [])).toBe(commands);
    });

    it('maps all commands', () => {
      const out = withPnpmMaturityExcludes(
        ['pnpm install --lockfile-only', 'pnpm dedupe --ignore-scripts'],
        ['pkg@1.0.0'],
      );
      expect(out).toHaveLength(2);
      expect(out[0]).toContain('minimumReleaseAgeExclude');
      expect(out[1]).toContain('minimumReleaseAgeExclude');
    });

    it('keeps existing workspace excludes when adding retry excludes', () => {
      const out = withPnpmMaturityExcludes(
        ['pnpm install --lockfile-only'],
        ['pkg@1.0.0'],
        ['existing@2.0.0'],
      );
      expect(out[0]).toContain(
        '--config.minimumReleaseAgeExclude[]=existing@2.0.0',
      );
      expect(out[0]).toContain('--config.minimumReleaseAgeExclude[]=pkg@1.0.0');
    });
  });
});
