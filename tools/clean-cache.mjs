import { tmpdir } from 'os';
import { remove } from 'fs-extra';
import { join } from 'upath';

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  const tmpDir = process.env.RENOVATE_TMPDIR ?? tmpdir();
  const renovateDir = join(tmpDir, 'renovate');
  // eslint-disable-next-line no-console
  console.log('Removing ' + renovateDir);
  await remove(renovateDir);
})();
