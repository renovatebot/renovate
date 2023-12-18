import got from 'got';
import { options } from './utils/options.mjs';

const version = options.release;
const tag = options.tag || 'latest';
const dry = options.dryRun;

console.log(`Dispatching version: ${version}`);

(async () => {
  if (dry) {
    console.log('DRY-RUN: done.');
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
    },
  );
})().catch((e) => {
  // Ignore for now
  console.warn(e.toString());
});
