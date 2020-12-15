import shell from 'shelljs';
import { generateDatasources } from './docs/datasources.js';
import { generateManagers } from './docs/manager.js';
import { generateModules } from './docs/modules.js';
import { generateVersioning } from './docs/versioning.js';

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  try {
    shell.echo('generating docs');
    shell.echo('===============');

    // shell.echo('copy assets');
    shell.cp('-r', '../usage/*', 'docs/');

    await generateModules();

    // versionigs
    await generateVersioning();

    // datasources
    await generateDatasources();

    // managers
    await generateManagers();
  } catch (e) {
    shell.echo(e.toString());
    shell.exit(1);
  }
})();
