#!/usr/bin/env node

import * as proxy from './proxy';
import * as globalWorker from './workers/global';

proxy.bootstrap();

(async () => {
  await globalWorker.start();
  // istanbul ignore if
  if ((global as any).renovateError) {
    process.exitCode = 1;
  }
})();
