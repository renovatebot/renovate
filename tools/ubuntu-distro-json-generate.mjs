import shell from 'shelljs';

shell.echo(`Verifying required packages...`);

if (!shell.which(`distro-info`)) {
  shell.echo('This script requires distro-info, exiting...');
  shell.exit(2);
}

if (!shell.which(`sed`)) {
  shell.echo('This script requires sed, exiting...');
  shell.exit(2);
}

if (!shell.which(`jo`)) {
  shell.echo('This script requires jo, exiting...');
  shell.exit(2);
}

const ubuntuDistroInfo = shell.exec(
  `ubuntu-distro-info --all -f | sed -r 's/Ubuntu|"|LTS //g; s/([0-9]+.[0-9]+) /\\1=/; s/.*/\\L&/; s/(=[a-z]*) [a-z]*/\\1/g; s/^[ \\t]*//' | jo`
);

shell.echo(ubuntuDistroInfo);
