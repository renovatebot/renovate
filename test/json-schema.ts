import shell from 'shelljs';

shell.exec('yarn create-json-schema');

const res = shell
  .exec('git status --porcelain', { silent: true })
  .grep('renovate-schema.json');

if (res.code === 0 && !res.includes('renovate-schema.json')) {
  shell.echo('PASS: renovate-schema.json is up to date');
  shell.exit(0);
} else {
  shell.echo(
    "ERROR: renovate-schema.json needs updating. Run 'yarn create-json-schema' and commit."
  );
  shell.exit(-1);
}
