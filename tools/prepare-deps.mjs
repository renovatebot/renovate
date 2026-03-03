import { execaSync } from 'execa';

function testRe2() {
  execaSync(
    'node',
    [
      '-e',
      `try{require('re2')('.*').exec('test')}catch(e){console.error(e);if(e.code === 'ERR_DLOPEN_FAILED' && e.message.includes('NODE_MODULE_VERSION')) process.exit(1); else process.exit(-1)}`,
    ],
    { stdio: 'inherit' },
  );
  console.log(`Ok.`);
}

function testSqlite() {
  execaSync(
    'node',
    [
      '-e',
      `try{new require('better-sqlite3')(':memory:')}catch(e){console.error(e);if(e.code === 'ERR_DLOPEN_FAILED' && e.message.includes('NODE_MODULE_VERSION')) process.exit(1); else process.exit(-1)}`,
    ],
    { stdio: 'inherit' },
  );
  console.log(`Ok.`);
}

(() => {
  console.log('Checking re2 ... ');
  try {
    testRe2();
  } catch (e) {
    console.error(`Failed.\n${e}`);
    try {
      if (e.exitCode === 1) {
        console.log(`Retry re2 install ...`);
        execaSync('pnpm', ['rb', 're2'], {
          stdio: 'inherit',
        });
        testRe2();
        return;
      }
    } catch (e1) {
      console.error(`Retry failed.\n${e1}`);
    }

    process.exit(1);
  }
})();

(() => {
  console.log('Checking better-sqlite3 ... ');
  try {
    testSqlite();
  } catch (e) {
    console.error(`Failed.\n${e}`);
    try {
      if (e.exitCode === 1) {
        console.log(`Retry better-sqlite3 install ...`);
        execaSync('pnpm', ['rb', 'better-sqlite3'], {
          stdio: 'inherit',
        });
        testSqlite();
        return;
      }
    } catch (e1) {
      console.error(`Retry failed.\n${e1}`);
    }

    process.exit(1);
  }
})();
