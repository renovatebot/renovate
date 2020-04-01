import shell from 'shelljs';

shell.echo(`Verifying ...`);

const res = shell.exec(`npm whoami`);
if (res.code !== 0) {
  shell.exit(2);
}
