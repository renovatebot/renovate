// hasPackageManager.test.ts
import { logger } from '../../../../../logger';
import { regEx } from '../../../../../util/regex';
import { hasPackageManager } from './package-file';

// Mock logger + regEx dependencies used by hasPackageManager
vitest.mock('../../../../../logger', () => ({
  logger: {
    trace: vitest.fn(),
    debug: vitest.fn(),
  },
}));
vitest.mock('../../../../../util/regex', () => ({
  // make regEx return a real RegExp so exec() behaves naturally
  regEx: vitest.fn((pattern: string) => new RegExp(pattern)),
}));

describe('modules/manager/npm/extract/common/package-file', () => {
  beforeEach(() => {
    vitest.clearAllMocks();
  });

  it('returns true for a valid packageManager with name@range (e.g. pnpm@8.15.4)', () => {
    const content = JSON.stringify({ packageManager: 'pnpm@8.15.4' });
    expect(hasPackageManager(content)).toBe(true);

    expect(logger.trace).toHaveBeenCalledWith(
      'npm.hasPackageManager from package.json',
    );
    expect(regEx).toHaveBeenCalledWith('^(?<name>.+)@(?<range>.+)$');
    expect(logger.debug).not.toHaveBeenCalled();
  });

  it('returns true for a valid range like npm@^9', () => {
    const content = JSON.stringify({ packageManager: 'npm@^9' });
    expect(hasPackageManager(content)).toBe(true);
  });

  it('returns true for yarn classic pin yarn@1.22.19', () => {
    const content = JSON.stringify({ packageManager: 'yarn@1.22.19' });
    expect(hasPackageManager(content)).toBe(true);
  });

  it("returns false when packageManager does not contain '@' (e.g. 'npm')", () => {
    const content = JSON.stringify({ packageManager: 'npm' });
    expect(hasPackageManager(content)).toBe(false);
  });

  it('returns false when packageManager is missing', () => {
    const content = JSON.stringify({ name: 'demo' });
    expect(hasPackageManager(content)).toBe(false);
  });

  it("returns false and logs 'Invalid JSON' when content is not valid JSON", () => {
    const bad = '{ not: valid json';
    expect(hasPackageManager(bad)).toBe(false);
    expect(logger.debug).toHaveBeenCalledWith('Invalid JSON');
  });

  it('returns false if packageManager is an empty string', () => {
    const content = JSON.stringify({ packageManager: '' });
    expect(hasPackageManager(content)).toBe(false);
  });
});
