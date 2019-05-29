#!/usr/bin/env node

import './proxy';
import * as globalWorker from './workers/global';

(async () => {
  await globalWorker.start();
  // istanbul ignore if
  if ((global as any).renovateError) {
    process.exitCode = 1;
  }
})();
