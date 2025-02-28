import { env } from 'process';

export function getCoverageIgnorePatterns(): string[] {
  const patterns = [];

  if (env.TEST_LEGACY_DECRYPTION !== 'true') {
    patterns.push('lib/config/decrypt/legacy.ts');
  }

  return patterns;
}

/**
 * Convert match pattern to a form that matches on file with `.ts` or `.spec.ts` extension.
 */
export function normalizePattern(
  pattern: string,
  suffix: '.ts' | '.spec.ts',
): string {
  return pattern.endsWith('.spec.ts')
    ? pattern.replace(/\.spec\.ts$/, suffix)
    : `${pattern}/**/*${suffix}`;
}
