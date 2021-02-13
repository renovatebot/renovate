const fs = require('fs-extra');
const os = require('os');
const path = require('path');

(async () => {
  const tmpDir = process.env.RENOVATE_TMPDIR || os.tmpdir();
  const renovateDir = path.join(tmpDir, 'renovate');
  console.log('Removing ' + renovateDir);
  await fs.remove(renovateDir);
})();
