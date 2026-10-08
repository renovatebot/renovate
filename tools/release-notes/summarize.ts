import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { init, logger } from '../../lib/logger/index.ts';
import { linkify } from '../../lib/util/markdown.ts';
import { exec } from '../utils/exec.ts';
import type { CommitTypeConfig, ParsedCommit } from './module-changelog.ts';
import {
  attributeReleases,
  dedupeCommits,
  escapeMentions,
  filterHiddenTypes,
  groupByModule,
  parseCommitHeader,
  renderModuleChangelog,
  resolveModuleLabels,
  stripPrReference,
} from './module-changelog.ts';

interface CliOptions {
  repo: string;
  all: boolean;
}

const defaultRepo = 'renovatebot/renovate';

async function loadCommitTypes(): Promise<CommitTypeConfig[]> {
  const releasercPath = fileURLToPath(
    new URL('../../.releaserc.json', import.meta.url),
  );
  const releaserc = JSON.parse(await readFile(releasercPath, 'utf8'));
  return releaserc.presetConfig.types as CommitTypeConfig[];
}

interface RawCommit {
  sha: string;
  header: string;
}

/**
 * Commits between two refs, oldest to newest, read from this checkout's
 * local git history rather than the GitHub API — this repo is exactly
 * where this tool runs from, so the full history and every release tag
 * are already right here, with no API round trip or pagination limit.
 */
async function getCommits(from: string, to: string): Promise<RawCommit[]> {
  const result = await exec('git', [
    'log',
    '--reverse',
    '--ancestry-path',
    '--pretty=format:%H\t%s',
    `${from}..${to}`,
  ]);

  return result.stdout
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => {
      const tab = line.indexOf('\t');
      return { sha: line.slice(0, tab), header: line.slice(tab + 1) };
    });
}

const RELEASE_TAG_RE = /^\d+\.\d+\.\d+$/;

/** Every release tag in this checkout, keyed by the commit it points at. */
async function getReleaseTagsByCommit(): Promise<Map<string, string>> {
  const result = await exec('git', [
    'for-each-ref',
    '--format=%(objectname) %(refname:short)',
    'refs/tags',
  ]);

  const bySha = new Map<string, string>();
  for (const line of result.stdout.split('\n')) {
    const [sha, tag] = line.split(' ');
    if (tag && RELEASE_TAG_RE.test(tag)) {
      bySha.set(sha, tag);
    }
  }
  return bySha;
}

async function summarize(
  repo: string,
  from: string,
  to: string,
  all: boolean,
): Promise<string> {
  const [rawCommits, types, releaseTagsByCommit] = await Promise.all([
    getCommits(from, to),
    loadCommitTypes(),
    getReleaseTagsByCommit(),
  ]);

  const releaseBySha = attributeReleases(
    rawCommits.map((commit) => commit.sha),
    releaseTagsByCommit,
  );

  const parsed: ParsedCommit[] = [];
  for (const rawCommit of rawCommits) {
    const commit = parseCommitHeader(rawCommit.header);
    if (commit) {
      parsed.push({
        ...commit,
        subject: stripPrReference(commit.subject),
        release: releaseBySha.get(rawCommit.sha),
      });
    }
  }

  const deduped = dedupeCommits(parsed);
  const commits = all ? deduped : filterHiddenTypes(deduped);
  const hiddenCount = deduped.length - commits.length;
  if (hiddenCount > 0) {
    logger.info(
      `Hid ${hiddenCount} test/style/ci/refactor commit(s); pass --all to include them.`,
    );
  }

  const scopes = commits
    .map((commit) => commit.scope)
    .filter((scope) => scope !== undefined);
  const labels = await resolveModuleLabels(scopes);

  const groups = groupByModule(commits, types, labels);
  const changelog = renderModuleChangelog(groups, repo);
  return await linkify(escapeMentions(changelog), { repository: repo });
}

await init();

process.on('unhandledRejection', (err) => {
  // Will print "unhandledRejection err is not defined"
  logger.error({ err }, 'unhandledRejection');
  process.exit(-1);
});

const program = new Command('node tools/release-notes/summarize.ts')
  .description(
    'Summarize the commits between two tags, grouped by module instead of by Conventional Commit type.',
  )
  .option(
    '--repo <owner/name>',
    'Repository to build GitHub links against (commits are always read from this local checkout)',
    defaultRepo,
  )
  .option(
    '--all',
    'Include test/style/ci/refactor commits, hidden by default',
    false,
  )
  .argument('<from>', 'tag/ref to compare from, for example 44.61.2')
  .argument('<to>', 'tag/ref to compare to, for example 44.61.3')
  .action(async (from: string, to: string, options: CliOptions) => {
    console.log(await summarize(options.repo, from, to, options.all));
  });

await program.parseAsync();
