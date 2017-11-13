const fs = require('fs-extra');
const os = require('os');

(async () => {
  await fs.remove(os.tmpdir() + '/renovate-changelog-cache');
  await fs.remove(os.tmpdir() + '/renovate-npm-cache');
})();
