import { build } from 'esbuild';
import { esbuildPluginNodeExternals } from 'esbuild-plugin-node-externals';
import fs from 'fs-extra';
import shell from 'shelljs';

// curretnly no toplevel await
(async () => {
  await build({
    entryPoints: ['lib/index.ts', 'lib/renovate.ts', 'lib/config-validator.ts'],
    bundle: true,
    format: 'esm',
    target: 'es2020',
    platform: 'node',
    outdir: './esm/',
    external: ['*/package.json', './lib/expose.cjs'],
    tsconfig: './tsconfig.esm.json',
    plugins: [
      esbuildPluginNodeExternals({
        packagePaths: 'package.json',
        include: [],
      }),
    ],
  });

  await fs.writeJSON('esm/package.json', { type: 'module' }, { spaces: 2 });
  await fs.copyFile('lib/expose.cjs', 'esm/expose.cjs');
})().catch((e) => {
  shell.echo(e);
  shell.exit(1);
});
