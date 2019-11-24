#!/usr/bin/env node

import * as proxy from './proxy';
import * as globalWorker from './workers/global';

proxy.bootstrap();

(async (): Promise<void> => {
  process.exitCode = await globalWorker.start();
})();
