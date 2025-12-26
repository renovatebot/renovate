import { validateExtractVersion } from './extract-version';

describe('config/validation-helpers/extract-version', () => {
  describe('validateExtractVersion', () => {
    it('returns null for string format (legacy)', () => {
      const result = validateExtractVersion(
        '^v(?<version>.+)$',
        'extractVersion',
      );
      expect(result).toBeNull();
    });

    it('returns null for single-element array format', () => {
      const result = validateExtractVersion(
        ['(?<version>.+)'],
        'extractVersion',
      );
      expect(result).toBeNull();
    });

    it('returns null when all template variables are captured', () => {
      const result = validateExtractVersion(
        ['^(?<version>\\d+\\.\\d+)', '{{version}}'],
        'extractVersion',
      );
      expect(result).toBeNull();
    });

    it('returns null when multiple template variables are all captured', () => {
      const result = validateExtractVersion(
        [
          '^(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)',
          '{{major}}.{{minor}}.{{patch}}',
        ],
        'extractVersion',
      );
      expect(result).toBeNull();
    });

    it('returns null when template uses conditionals with captured variables', () => {
      const result = validateExtractVersion(
        [
          '^(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)(?:-(?<prerelease>.*))?$',
          '{{major}}.{{minor}}.{{patch}}{{#if prerelease}}-{{prerelease}}{{/if}}',
        ],
        'extractVersion',
      );
      expect(result).toBeNull();
    });

    it('returns warning when template variable is not captured', () => {
      const result = validateExtractVersion(
        ['^(?<version>\\d+\\.\\d+)', '{{major}}.{{minor}}'],
        'packageRules[0].extractVersion',
      );
      expect(result).toMatchObject({
        topic: 'Configuration Warning',
        message: expect.stringContaining('major, minor'),
      });
      expect(result?.message).toContain('not captured by the regex pattern');
      expect(result?.message).toContain('packageRules[0].extractVersion');
    });

    it('returns warning listing all missing variables', () => {
      const result = validateExtractVersion(
        ['^(?<version>\\d+)', '{{major}}.{{minor}}.{{patch}}'],
        'extractVersion',
      );
      expect(result).toMatchObject({
        topic: 'Configuration Warning',
        message: expect.stringContaining('major, minor, patch'),
      });
    });

    it('returns warning when conditional variable is not captured', () => {
      const result = validateExtractVersion(
        [
          '^(?<version>\\d+)',
          '{{version}}{{#if prerelease}}-{{prerelease}}{{/if}}',
        ],
        'extractVersion',
      );
      expect(result).toMatchObject({
        topic: 'Configuration Warning',
        message: expect.stringContaining('prerelease'),
      });
    });

    it('shows available capture groups in error message', () => {
      const result = validateExtractVersion(
        ['^(?<version>\\d+)\\.(?<build>\\d+)', '{{major}}.{{minor}}'],
        'extractVersion',
      );
      expect(result?.message).toContain(
        'Available capture groups: [version, build]',
      );
    });

    it('shows "none" when no capture groups are available', () => {
      const result = validateExtractVersion(
        ['^\\d+\\.\\d+', '{{version}}'],
        'extractVersion',
      );
      expect(result?.message).toContain('Available capture groups: [none]');
    });

    it('returns null for invalid array format (not our concern)', () => {
      const result = validateExtractVersion(
        ['regex', 'template', 'extra'] as any,
        'extractVersion',
      );
      expect(result).toBeNull();
    });

    it('detects missing variable even with malformed regex', () => {
      // Malformed regex that doesn't capture properly
      const result = validateExtractVersion(
        ['(?<version', '{{version}}'],
        'extractVersion',
      );
      // The validation still works - it just won't find any capture groups
      expect(result).toMatchObject({
        topic: 'Configuration Warning',
        message: expect.stringContaining('version'),
      });
    });

    it('handles complex real-world example correctly', () => {
      const result = validateExtractVersion(
        [
          '^release-(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)(?:-(?<prerelease>.*))?$',
          'v{{major}}.{{minor}}.{{patch}}{{#if prerelease}}-{{prerelease}}{{/if}}',
        ],
        'extractVersion',
      );
      expect(result).toBeNull();
    });

    it('detects missing variable in complex template', () => {
      const result = validateExtractVersion(
        ['^(?<major>\\d+)\\.(?<minor>\\d+)$', '{{major}}.{{minor}}.{{patch}}'],
        'extractVersion',
      );
      expect(result).toMatchObject({
        topic: 'Configuration Warning',
        message: expect.stringContaining('patch'),
      });
    });
  });
});
