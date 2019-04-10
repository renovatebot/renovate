const fs = require('fs-extra');
const os = require('os');
const path = require('path');

(async () => {
  const tmpDir = process.env.RENOVATE_TMPDIR || os.tmpdir();
  const baseDir = path.join(tmpDir, 'renovate');
  console.log('Removing ' + baseDir);
  await fs.remove(baseDir);
})();
