import shell from 'shelljs';
import { program, exec } from './utils.mjs';

const version = program.release;
const sha = program.sha;

let err = false;

shell.echo(`Publishing version: ${version}`);

shell.echo('Publishing docker images ...');
err = err && !exec(`./.github/workflows/release-docker.sh ${version} ${sha}`);

shell.echo('Publishing npm package ...');
err =
  err &&
  !exec(`yarn publish --non-interactive --new-version ${version} --verbose`);

if (err) shell.exit(1);
