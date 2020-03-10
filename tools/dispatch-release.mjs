import got from 'got';
import shell from 'shelljs';

const baseUrl = 'https://api.github.com/';

(async () => {
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
      },
    },
  });
})().catch(e => {
  // Ignore for now
  shell.echo(e.toString());
});
