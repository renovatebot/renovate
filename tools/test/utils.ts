import { env } from 'process';

export function getCoverageIgnorePatterns(): string[] | undefined {
  const patterns = ['/node_modules/', '<rootDir>/test/', '<rootDir>/tools/'];

  if (env.TEST_LEGACY_DECRYPTION !== 'true') {
    patterns.push('<rootDir>/lib/config/decrypt/legacy.ts');
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
