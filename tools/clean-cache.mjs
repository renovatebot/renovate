import { tmpdir } from 'node:os';
import { remove } from 'fs-extra';
import upath from 'upath';

await (async () => {
  const tmpDir = process.env.RENOVATE_TMPDIR ?? tmpdir();
  const renovateDir = upath.join(tmpDir, 'renovate');
  console.log('Removing ' + renovateDir);
  await remove(renovateDir);
})();
