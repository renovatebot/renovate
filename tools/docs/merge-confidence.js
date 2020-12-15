import got from 'got';
import { updateFile } from '../utils/index.js';

export async function generateMergeConfidence() {
  let body = await got(
    'https://raw.githubusercontent.com/whitesource/merge-confidence/main/README.md'
  ).text();

  body = body.replace(
    /^# (.+?)$/m,
    `---
title: $1
---
`
  );

  await updateFile('./docs/merge-confidence.md', body);
}
