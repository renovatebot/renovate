import { GlobalConfig } from '../../../../../config/global';
import { logger } from '../../../../../logger';
import { hasPackageManager } from './package-file';
import { Fixtures } from '~test/fixtures';

vi.mock('fs-extra', async () =>
  (
    await vi.importActual<typeof import('~test/fixtures')>('~test/fixtures')
  ).fsExtra(),
);

describe('modules/manager/npm/extract/common/package-file', () => {
  beforeEach(() => {
    Fixtures.reset();
    GlobalConfig.set({ localDir: '/', cacheDir: '/tmp/cache' });
  });

  it('returns true for a valid packageManager with name@version(e.g. pnpm@8.15.4)', async () => {
    Fixtures.mock({
      '/repo/package.json': JSON.stringify({ packageManager: 'pnpm@8.15.4' }),
    });
    await expect(hasPackageManager('/repo')).resolves.toBe(true);

    // eslint-disable-next-line vitest/prefer-called-exactly-once-with
    expect(logger.trace).toHaveBeenCalledWith(
      'npm.hasPackageManager from package.json',
    );
  });

  it('returns true for a valid range like npm@^9', async () => {
    Fixtures.mock({
      '/repo/package.json': JSON.stringify({ packageManager: 'npm@^9' }),
    });
    await expect(hasPackageManager('/repo')).resolves.toBe(true);
  });

  it('returns true for yarn classic pin yarn@1.22.19', async () => {
    Fixtures.mock({
      '/repo/package.json': JSON.stringify({ packageManager: 'yarn@1.22.19' }),
    });
    await expect(hasPackageManager('/repo')).resolves.toBe(true);
  });

  it("returns false when packageManager does not contain '@' (e.g. 'npm')", async () => {
    Fixtures.mock({
      '/repo/package.json': JSON.stringify({ packageManager: 'npm' }),
    });
    await expect(hasPackageManager('/repo')).resolves.toBe(false);
  });

  it('returns false when packageManager is missing', async () => {
    Fixtures.mock({ '/repo/package.json': JSON.stringify({ name: 'demo' }) });
    await expect(hasPackageManager('/repo')).resolves.toBe(false);
  });

  it('returns false when package.json is invalid', async () => {
    Fixtures.mock({ '/repo/package.json': '{ not: valid json' });
    await expect(hasPackageManager('/repo')).resolves.toBe(false);
  });

  it('returns false if packageManager is an empty string', async () => {
    Fixtures.mock({
      '/repo/package.json': JSON.stringify({ packageManager: '' }),
    });
    await expect(hasPackageManager('/repo')).resolves.toBe(false);
  });
});
