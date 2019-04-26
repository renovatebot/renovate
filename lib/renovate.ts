#!/usr/bin/env node

require('./proxy');
const globalWorker = require('./workers/global');

(async () => {
  await globalWorker.start();
  // istanbul ignore if
  if ((global as any).renovateError) {
    process.exitCode = 1;
  }
})();
