import shell from 'shelljs';

shell.echo(`Verifying ...`);

shell.exec(`npm config ls`);

const res = shell.exec(`npm whoami`);
if (res.code !== 0) {
  shell.exit(2);
}
