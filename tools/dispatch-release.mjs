import got from 'got';
import shell from 'shelljs';
import { options } from './utils.mjs';

const version = options.release;
const tag = options.tag || 'latest';
const dry = options.dryRun;

shell.echo(`Dispatching version: ${version}`);

(async () => {
  if (dry) {
    shell.echo('DRY-RUN: done.');
    return;
  }
  await got(
    `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/dispatches`,
    {
      headers: {
        'user-agent': 'Renovate release helper',
        authorization: `token ${process.env.GITHUB_TOKEN}`,
      },
      method: 'POST',
      json: {
        event_type: 'renovate-release',
        // max 10 keys here, https://github.com/peter-evans/repository-dispatch#client-payload
        client_payload: {
          sha: process.env.GITHUB_SHA,
          ref: process.env.GITHUB_REF,
          version,
          tag,
        },
      },
    }
  );
})().catch((e) => {
  // Ignore for now
  shell.echo(e.toString());
});
