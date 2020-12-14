import shell from 'shelljs';
import { generateManagers } from './docs/manager.js';
import { generateModules } from './docs/modules.js';

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  try {
    shell.echo('generating docs');
    shell.echo('===============');

    // shell.echo('copy assets');
    shell.cp('-r', '../usage/*', 'docs/');

    await generateModules();

    // datasources
    // await generate({ path: 'datasource' });

    // managers
    await generateManagers();
  } catch (e) {
    shell.echo(e.toString());
    shell.exit(1);
  }
})();
