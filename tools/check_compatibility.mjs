import shell from 'shelljs';

function doSomething() {
  let obj = shell.exec('get-git-version', { silent: true }).stdout.toString();
  obj = obj.split('{')[1].split(',')[1].split(':')[1].split('-');
  const verSion = obj[0].split('"')[1].slice(1).split('.');
  if (
    parseInt(verSion[0], 10) >= 2 &&
    parseInt(verSion[1], 10) >= 22 &&
    parseInt(verSion[2], 10) >= 0
  ) {
    shell.echo('OK');
  } else {
    shell.echo('NOT OK');
  }
}
doSomething();
