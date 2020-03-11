import shell from 'shelljs';
import program from './utils.mjs';

const version = program.release;
const sha = program.sha;
const dry = program.dryRun;

let err = false;

if (!version) {
  shell.echo('Missing version argument!');
  shell.exit(2);
}

shell.echo(`Publishing version: ${version}`);

try {
  shell.echo('Publishing docker images ...');
  if (!dry)
    shell.exec(`./.github/workflows/release-docker.sh ${version} ${sha}`);
  else shell.echo('dry-run done.');
} catch (e) {
  shell.echo(e.toString());
  err = true;
}

try {
  shell.echo('Publishing npm package ...');
  if (!dry)
    shell.exec(`yarn publish --non-interactive --new-version ${version}`);
  else shell.echo('dry-run done.');
} catch (e) {
  shell.echo(e.toString());
  err = true;
}

if (err) shell.exit(1);
