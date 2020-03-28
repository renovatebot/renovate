import core from '@actions/core';
import { program, exec } from './utils.mjs';
import dispatch from './dispatch-release.mjs';

const version = program.release;
const sha = program.sha;

let err = false;

core.info(`Publishing version: ${version}`);

core.info('Publishing npm package ...');
if (
  !exec(`npm --no-git-tag-version version ${version}`) ||
  !exec(`npm publish`, [
    'You cannot publish over the previously published versions',
  ])
) {
  err = true;
}

core.info('Publishing docker images ...');
if (!exec(`./.github/workflows/release-docker.sh ${version} ${sha}`)) {
  err = true;
}

dispatch();

if (err) {
  core.setFailed('release failed partially');
}
