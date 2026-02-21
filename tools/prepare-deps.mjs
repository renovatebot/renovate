import { execa } from 'execa';

async function testRe2() {
  await execa(
    'node',
    [
      '-e',
      `try{require('re2')('.*').exec('test')}catch(e){console.error(e);if(e.code === 'ERR_DLOPEN_FAILED' && e.message.includes('NODE_MODULE_VERSION')) process.exit(1); else process.exit(-1)}`,
    ],
    { stdio: 'inherit' },
  );
  console.log(`Ok.`);
}

async function testSqlite() {
  await execa(
    'node',
    [
      '-e',
      `try{new require('better-sqlite3')(':memory:')}catch(e){console.error(e);if(e.code === 'ERR_DLOPEN_FAILED' && e.message.includes('NODE_MODULE_VERSION')) process.exit(1); else process.exit(-1)}`,
    ],
    { stdio: 'inherit' },
  );
  console.log(`Ok.`);
}

void (async () => {
  console.log('Checking re2 ... ');
  try {
    await testRe2();
  } catch (e) {
    console.error(`Failed.\n${e}`);
    try {
      if (e.exitCode === 1) {
        console.log(`Retry re2 install ...`);
        await execa('pnpm', ['rb', 're2'], {
          stdio: 'inherit',
        });
        await testRe2();
        return;
      }
    } catch (e1) {
      console.error(`Retry failed.\n${e1}`);
    }

    process.exit(1);
  }
})();

void (async () => {
  console.log('Checking better-sqlite3 ... ');
  try {
    await testSqlite();
  } catch (e) {
    console.error(`Failed.\n${e}`);
    try {
      if (e.exitCode === 1) {
        console.log(`Retry better-sqlite3 install ...`);
        await execa('pnpm', ['rb', 'better-sqlite3'], {
          stdio: 'inherit',
        });
        await testSqlite();
        return;
      }
    } catch (e1) {
      console.error(`Retry failed.\n${e1}`);
    }

    process.exit(1);
  }
})();
