// Co-authored-by: Claude Opus 4.8
import { readFile } from 'node:fs/promises';
import { argv, env, stdin } from 'node:process';
import { pathToFileURL } from 'node:url';
import { analyzeCommits } from '@semantic-release/commit-analyzer';
import releaseRc from '../.releaserc.json' with { type: 'json' };

export type ReleaseType = 'major' | 'minor' | 'patch' | null;

// semantic-release merges the root-level `preset`/`presetConfig` and the
// `analyzeCommits.releaseRules` from `.releaserc.json` into the plugin config it
// hands to `@semantic-release/commit-analyzer` (see its `plugins/index.js` and
// `plugins/normalize.js`). We reconstruct exactly that config here so our
// verdict matches what a real release would decide.
const pluginConfig = {
  preset: releaseRc.preset,
  presetConfig: releaseRc.presetConfig,
  releaseRules: releaseRc.analyzeCommits?.releaseRules,
};

// commit-analyzer only calls `logger.log` for progress; silence it.
const context = {
  logger: { log: (): void => undefined },
  cwd: process.cwd(),
  env,
};

/**
 * Determine the release type that the given commit messages would produce,
 * using semantic-release's own commit-analyzer with this repo's config.
 */
export function getReleaseType(messages: string[]): Promise<ReleaseType> {
  const commits = messages.map((message, index) => ({
    message,
    // synthetic but unique hashes, so revert-filtering behaves predictably
    hash: index.toString(16).padStart(7, '0'),
  }));
  return analyzeCommits(pluginConfig, { ...context, commits });
}

/**
 * Return the subset of commit messages that would, on their own, trigger a
 * major release. Used only to produce a helpful report.
 */
export async function findMajorCommits(messages: string[]): Promise<string[]> {
  const major: string[] = [];
  for (const message of messages) {
    if ((await getReleaseType([message])) === 'major') {
      major.push(message);
    }
  }
  return major;
}

function firstLine(message: string): string {
  return message.split('\n')[0];
}

async function readInput(source: string | undefined): Promise<string> {
  if (source && source !== '-') {
    return readFile(source, 'utf8');
  }
  const chunks: Buffer[] = [];
  for await (const chunk of stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function parseMessages(raw: string): string[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.some((m) => typeof m !== 'string')) {
    throw new Error(
      'Expected input to be a JSON array of commit-message strings',
    );
  }
  return parsed as string[];
}

async function main(): Promise<void> {
  const messages = parseMessages(await readInput(argv[2]));

  if (messages.length === 0) {
    console.log('No commit messages to analyze.');
    return;
  }

  const releaseType = await getReleaseType(messages);
  console.log(`Computed release type: ${releaseType ?? 'none'}`);

  if (releaseType !== 'major') {
    console.log('✓ No commit would trigger a new major version.');
    return;
  }

  const offenders = await findMajorCommits(messages);
  const title = 'Unexpected major release';
  const hint =
    'A commit uses a breaking-change marker (`!` in the header, or a ' +
    '`BREAKING CHANGE:`/`BREAKING-CHANGE:` note), which makes semantic-release ' +
    'publish a new major version. Remove the marker, or — if a major bump is ' +
    'intended (e.g. preparing the next major) — override this check manually.';

  if (env.CI) {
    for (const message of offenders) {
      console.log(`::error title=${title}::${firstLine(message)} — ${hint}`);
    }
    if (offenders.length === 0) {
      console.log(`::error title=${title}::${hint}`);
    }
  } else {
    console.error(`${title}: ${hint}`);
    for (const message of offenders) {
      console.error(`- ${firstLine(message)}`);
    }
  }

  process.exitCode = 1;
}

// Only run when executed directly, so tests can import the helpers.
if (argv[1] && import.meta.url === pathToFileURL(argv[1]).href) {
  await main();
}
