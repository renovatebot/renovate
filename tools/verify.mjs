import shell from 'shelljs';
import { exec } from './utils.mjs';

let err = false;

shell.echo(`Verifying ...`);

if (!exec(`npm whoami`)) {
  err = true;
}

if (err) {
  shell.exit(1);
}
