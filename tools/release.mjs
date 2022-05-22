import shell from 'shelljs';
import { options } from './utils/options.mjs';

const version = options.release;

shell.echo(`Publishing version: ${version}`);

// eslint-disable-next-line promise/valid-params,@typescript-eslint/no-floating-promises
import('./dispatch-release.mjs').catch();
