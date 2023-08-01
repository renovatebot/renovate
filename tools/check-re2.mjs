await (async () => {
  console.log('Checking re2 ... ');
  try {
    const { RE2 } = await import('re2-wasm');
    new RE2('.*', 'u').exec('test');
    console.log(`ok.`);
  } catch (e) {
    console.error(`error.\n${e}`);
    process.exit(1);
  }
})();
