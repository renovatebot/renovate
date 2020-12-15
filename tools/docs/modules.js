import shell from 'shelljs';

// import { readFile, updateFile } from '../utils/index.js';
// // import { getDisplayName, getNameWithUrl, replaceContent } from './utils.js';

// const fileRe = /modules[/\\](.+?)\.md$/;
// const titleRe = /^#(.+?)$/m;

export async function generateModules() {
  shell.mkdir(
    '-p',
    // 'docs/modules/datasource',
    'docs/modules/manager'
    // 'docs/modules/platform',
    // 'docs/modules/versioning'
  );

  //   for (const f of shell.ls('../usage/modules/*.md')) {
  //     const [, tgt] = fileRe.exec(f);

  //     let content = await readFile(f);
  //     content = content.replace(
  //       titleRe,
  //       `---
  // title: $1
  // ---
  // `
  //     );

  //     await updateFile(`./docs/modules/${tgt}.md`, content);
  //   }

  await Promise.resolve();
}
