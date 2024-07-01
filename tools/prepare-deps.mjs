import { execSync } from 'child_process';

async function testRe2() {
  const { default: RE2 } = await import('re2');
  new RE2('.*').exec('test');
  console.log(`ok.`);
}

async function testSqlite() {
  const { default: Sqlite } = await import('better-sqlite3');
  new Sqlite(':memory:');
  console.log(`ok.`);
}

await (async () => {
  console.log('Checking re2 ... ');
  try {
    await testRe2();
  } catch (e) {
    console.error(`failed.\n${e}`);
    try {
      if (
        e.code === 'ERR_DLOPEN_FAILED' &&
        e.message.includes('NODE_MODULE_VERSION')
      ) {
        console.log(`Retry re2 install ...`);
        execSync('pnpm run install', {
          stdio: 'inherit',
          cwd: `${process.cwd()}/node_modules/re2`,
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

await (async () => {
  console.log('Checking better-sqlite3 ... ');
  try {
    await testSqlite();
  } catch (e) {
    console.error(`failed.\n${e}`);
    try {
      if (
        e.code === 'ERR_DLOPEN_FAILED' &&
        e.message.includes('NODE_MODULE_VERSION')
      ) {
        console.log(`Retry better-sqlite3 install ...`);
        execSync('pnpm run install', {
          stdio: 'inherit',
          cwd: `${process.cwd()}/node_modules/better-sqlite3`,
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
