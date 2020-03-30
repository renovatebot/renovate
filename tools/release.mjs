import shell from 'shelljs';
import { program } from './utils.mjs';

const version = program.release;
// const sha = program.sha;

// let err = false;

shell.echo(`Publishing version: ${version}`);

// shell.echo('Publishing npm package ...');
// if (
//   !exec(`npm --no-git-tag-version version ${version}`) ||
//   !exec(`npm publish`)
// ) {
//   err = true;
// }

// shell.echo('Publishing docker images ...');
// if (!exec(`./.github/workflows/release-docker.sh ${version} ${sha}`)) {
//   err = true;
// }

// eslint-disable-next-line promise/valid-params
import('./dispatch-release.mjs').catch();

// if (err) {
//   shell.exit(2);
// }
