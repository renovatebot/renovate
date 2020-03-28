import got from 'got';
import core from '@actions/core';
import { program } from './utils.mjs';

const version = program.release;
const dry = program.dryRun;

const baseUrl = 'https://api.github.com/';

export default async function run() {
  core.info(`Dispatching version: ${version}`);

  if (dry) {
    core.warning('DRY-RUN: done.');
    return;
  }
  try {
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
  } catch (e) {
    // Ignore for now
    core.error(e.toString());
  }
}
