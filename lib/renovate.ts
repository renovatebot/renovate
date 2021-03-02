#!/usr/bin/env node

import { bootstrap } from './proxy';
import { start } from './workers/global';

bootstrap();

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async (): Promise<void> => {
  process.exitCode = await start();
})();
