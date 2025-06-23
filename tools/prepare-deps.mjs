import { execSync } from 'child_process';

function testRe2() {
  execSync(
    `node -e "try{require('re2')('.*').exec('test')}catch(e){console.error(e);if(e.code === 'ERR_DLOPEN_FAILED' && e.message.includes('NODE_MODULE_VERSION')) process.exit(1); else process.exit(-1)}"`,
    { stdio: 'inherit' },
  );
  console.log(`Ok.`);
}

function testSqlite() {
  execSync(
    `node -e "try{new require('better-sqlite3')(':memory:')}catch(e){console.error(e);if(e.code === 'ERR_DLOPEN_FAILED' && e.message.includes('NODE_MODULE_VERSION')) process.exit(1); else process.exit(-1)}"`,
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
      if (e.status === 1) {
        console.log(`Retry re2 install ...`);
        execSync('pnpm rb re2', {
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
      if (e.status === 1) {
        console.log(`Retry better-sqlite3 install ...`);
        execSync('pnpm rb better-sqlite3', {
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
