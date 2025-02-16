import { env } from 'process';

export function getCoverageIgnorePatterns(): string[] | undefined {
  const patterns = ['/node_modules/', '<rootDir>/test/', '<rootDir>/tools/'];

  if (env.TEST_LEGACY_DECRYPTION !== 'true') {
    patterns.push('<rootDir>/lib/config/decrypt/legacy.ts');
  }

  return patterns;
}
