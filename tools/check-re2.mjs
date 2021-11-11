import shell from 'shelljs';

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  shell.echo('-n', 'Checking re2 ... ');
  try {
    const { default: RE2 } = await import('re2');
    new RE2('.*').exec('test');
    shell.echo(`ok.`);
  } catch (e) {
    shell.echo(`error.\n${e}`);
    shell.echo();
    shell.exit(1);
  }
})();
