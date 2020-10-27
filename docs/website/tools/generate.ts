// import fs from 'fs-extra';
import shell from 'shelljs';

shell.echo('generating docs');
shell.echo('===============');

// shell.echo('copy assets');
shell.cp('-r', '../usage/*', 'docs/');

// shell.echo('copy usage docs');
// shell.ls('../usage/**/*.md').forEach(f => {
//   const tgt = `./docs/${f.substr(9)}`
//   fs.copySync(f, tgt);
// })
