#!/usr/bin/env node

import * as proxy from './proxy';
import * as globalWorker from './workers/global';

proxy.bootstrap();

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async (): Promise<void> => {
  process.exitCode = await globalWorker.start();
})();
