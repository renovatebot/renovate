import shell from 'shelljs';
import { generateDatasources } from './docs/datasources.js';
import { generateManagers } from './docs/manager.js';
import { generateModules } from './docs/modules.js';
import { generatePresets } from './docs/presets.js';
import { generateTemplates } from './docs/templates.js';
import { generateVersioning } from './docs/versioning.js';

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  try {
    shell.echo('generating docs');
    shell.echo('===============');

    shell.echo('* static');
    shell.cp('-r', '../usage/*', 'docs/');

    shell.echo('* modules');
    await generateModules();

    // versionigs
    shell.echo('* versionigs');
    await generateVersioning();

    // datasources
    shell.echo('* datasources');
    await generateDatasources();

    // managers
    shell.echo('* managers');
    await generateManagers();

    // presets
    shell.echo('* presets');
    await generatePresets();

    // templates
    shell.echo('* templates');
    await generateTemplates();
  } catch (e) {
    shell.echo(e.toString());
    shell.exit(1);
  }
})();
