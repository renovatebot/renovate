const fs = require('fs-extra');
const os = require('os');

(async () => {
  await fs.remove(os.tmpdir() + '/renovate-cache-changelog-v2');
  await fs.remove(os.tmpdir() + '/renovate-npm-cache');
})();
