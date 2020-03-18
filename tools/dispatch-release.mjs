import got from 'got';
import shell from 'shelljs';
import { program } from './utils.mjs';

const version = program.release;
const dry = program.dryRun;

const baseUrl = 'https://api.github.com/';

shell.echo(`Dispatching version: ${version}`);

(async () => {
  if (dry) {
    shell.echo('dry-run done.');
    return;
  }
  await got(`repos/${process.env.GITHUB_REPOSITORY}/dispatches`, {
    baseUrl,
    headers: {
      'user-agent': 'Renovate release helper',
      authorization: `token ${process.env.GITHUB_TOKEN}`,
    },
    json: true,
    retry: 5,
    body: {
      event_type: 'renovate-release',
      // max 10 keys here, https://github.com/peter-evans/repository-dispatch#client-payload
      client_payload: {
        sha: process.env.GITHUB_SHA,
        ref: process.env.GITHUB_REF,
        version,
      },
    },
  });
})().catch(e => {
  // Ignore for now
  shell.echo(e.toString());
});
