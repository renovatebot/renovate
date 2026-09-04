import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { init, logger } from '../../lib/logger/index.ts';
import { linkify } from '../../lib/util/markdown.ts';
import { exec } from '../utils/exec.ts';
import type { CommitTypeConfig } from './module-changelog.ts';
import {
  groupByModule,
  parseCommitHeader,
  renderModuleChangelog,
} from './module-changelog.ts';

interface CliOptions {
  repo: string;
}

const defaultRepo = 'renovatebot/renovate';

async function loadCommitTypes(): Promise<CommitTypeConfig[]> {
  const releasercPath = fileURLToPath(
    new URL('../../.releaserc.json', import.meta.url),
  );
  const releaserc = JSON.parse(await readFile(releasercPath, 'utf8'));
  return releaserc.presetConfig.types as CommitTypeConfig[];
}

interface CompareCommit {
  commit: { message: string };
}

async function getCommitHeaders(
  repo: string,
  from: string,
  to: string,
): Promise<string[]> {
  const result = await exec('gh', [
    'api',
    `repos/${repo}/compare/${from}...${to}`,
  ]);

  const response = JSON.parse(result.stdout) as { commits: CompareCommit[] };
  return response.commits.map(
    (compareCommit) => compareCommit.commit.message.split('\n')[0],
  );
}

async function summarize(
  repo: string,
  from: string,
  to: string,
): Promise<string> {
  const [headers, types] = await Promise.all([
    getCommitHeaders(repo, from, to),
    loadCommitTypes(),
  ]);

  const commits = [];
  for (const header of headers) {
    const commit = parseCommitHeader(header);
    if (commit) {
      commits.push(commit);
    }
  }

  const groups = groupByModule(commits, types);
  const changelog = renderModuleChangelog(groups);
  return await linkify(changelog, { repository: repo });
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
  .option('--repo <owner/name>', 'Repository to query', defaultRepo)
  .argument('<from>', 'tag/ref to compare from, for example 44.61.2')
  .argument('<to>', 'tag/ref to compare to, for example 44.61.3')
  .action(async (from: string, to: string, options: CliOptions) => {
    console.log(await summarize(options.repo, from, to));
  });

await program.parseAsync();
