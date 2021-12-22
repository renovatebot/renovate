const os = require('os');
const path = require('path');
const fs = require('fs-extra');

void (async () => {
  const tmpDir = process.env.RENOVATE_TMPDIR || os.tmpdir();
  const renovateDir = path.join(tmpDir, 'renovate');
  // eslint-disable-next-line no-console
  console.log('Removing ' + renovateDir);
  await fs.remove(renovateDir);
})();
