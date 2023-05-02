await (async () => {
  console.log('Checking re2 ... ');
  try {
    const { default: RE2 } = await import('re2');
    new RE2('.*').exec('test');
    console.log(`ok.`);
  } catch (e) {
    console.error(`error.\n${e}`);
    process.exit(1);
  }
})();
