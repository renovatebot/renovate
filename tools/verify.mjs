import shell from 'shelljs';

shell.echo(`Verifying ...`);

shell.exec(`npm config ls`);
shell.exec(`cat /home/runner/work/_temp/.npmrc`);
shell.exec(`env | grep NPM_`);
shell.exec(`env | grep NODE_`);

const res = shell.exec(`npm whoami`);
if (res.code !== 0) {
  shell.exit(2);
}
