import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createSimpleGit } from '../lib/util/git/index.ts';

const closingKeywordRe =
  /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)(?:\s*:\s*|\s+)(?:(?:renovatebot\/renovate)?#|https:\/\/github\.com\/renovatebot\/renovate\/(?:issues|discussions)\/)(?<issue>\d+)\b/gi;
const todoIssueRefRe =
  /\bTODO\b.*(?:(?:renovatebot\/renovate)?#|https:\/\/github\.com\/renovatebot\/renovate\/(?:issues|discussions)\/)(?<issue>\d+)\b/i;
const fencedCodeBlockRe =
  /(?:^|\n)(?:```|~~~)[\s\S]*?(?:\n(?:```|~~~)(?=\n|$)|$)/g;
const inlineCodeRe = /`[^`\r\n]*`/g;

export interface TodoIssueRef {
  file: string;
  line: number;
  issue: string;
  text: string;
}

interface GitHubPullRequestEvent {
  pull_request?: {
    title?: string | null;
    body?: string | null;
  };
}

export function extractClosingIssueRefs(text: string): Set<string> {
  const refs = new Set<string>();
  const searchableText = text
    .replace(fencedCodeBlockRe, '\n')
    .replace(inlineCodeRe, '');

  for (const match of searchableText.matchAll(closingKeywordRe)) {
    if (match.groups?.issue) {
      refs.add(match.groups.issue);
    }
  }

  return refs;
}

export function parseTodoIssueRef(line: string): TodoIssueRef | null {
  const [file, lineNumber, ...textParts] = line.split(':');
  const text = textParts.join(':');
  const issue = todoIssueRefRe.exec(text)?.groups?.issue;

  if (!file || !lineNumber || !issue) {
    return null;
  }

  return {
    file,
    line: Number.parseInt(lineNumber, 10),
    issue,
    text: text.trim(),
  };
}

export function findMatchingTodoRefs(
  grepOutput: string,
  closingRefs: Set<string>,
): TodoIssueRef[] {
  return grepOutput
    .split(/\r?\n/)
    .map(parseTodoIssueRef)
    .filter(
      (ref): ref is TodoIssueRef => ref !== null && closingRefs.has(ref.issue),
    );
}

export function extractPullRequestTextFromGitHubEvent(
  event: GitHubPullRequestEvent,
): string {
  return [event.pull_request?.title, event.pull_request?.body]
    .filter(Boolean)
    .join('\n');
}

async function getPullRequestText(): Promise<string> {
  const envText = [
    process.env.RENOVATE_PR_TITLE,
    process.env.RENOVATE_PR_BODY,
    process.env.PR_TITLE,
    process.env.PR_BODY,
  ]
    .filter(Boolean)
    .join('\n');

  if (envText) {
    return envText;
  }

  if (
    process.env.GITHUB_EVENT_NAME === 'pull_request' &&
    process.env.GITHUB_EVENT_PATH
  ) {
    const event = JSON.parse(
      await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'),
    ) as GitHubPullRequestEvent;
    return extractPullRequestTextFromGitHubEvent(event);
  }

  return '';
}

function isGitGrepNoMatchesError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) {
    return false;
  }

  const maybeGitError = err as { exitCode?: number; message?: string };
  return (
    maybeGitError.exitCode === 1 ||
    /\b(?:exit code|status)\s+1\b/i.test(maybeGitError.message ?? '')
  );
}

async function gitGrepTodos(): Promise<string> {
  try {
    return await createSimpleGit().raw([
      'grep',
      '-n',
      '-I',
      '-E',
      'TODO.*((renovatebot/renovate)?#[0-9][0-9]*|github\\.com/renovatebot/renovate/(issues|discussions)/[0-9][0-9]*)',
      '--',
      '.',
    ]);
  } catch (err) {
    if (isGitGrepNoMatchesError(err)) {
      return '';
    }

    throw err;
  }
}

export function checkTodoIssueRefs(
  pullRequestText: string,
  grepOutput: string,
): TodoIssueRef[] {
  const closingRefs = extractClosingIssueRefs(pullRequestText);

  if (closingRefs.size === 0) {
    return [];
  }

  return findMatchingTodoRefs(grepOutput, closingRefs);
}

function escapeWorkflowCommandValue(value: string): string {
  return value
    .replaceAll('%', '%25')
    .replaceAll('\r', '%0D')
    .replaceAll('\n', '%0A');
}

function error(message: string): void {
  if (process.env.CI) {
    console.error(`::error ::${escapeWorkflowCommandValue(message)}`);
    return;
  }

  console.error(message);
}

async function main(): Promise<void> {
  const matches = checkTodoIssueRefs(
    await getPullRequestText(),
    await gitGrepTodos(),
  );

  if (matches.length === 0) {
    return;
  }

  error('Found TODO comments that still reference issues this PR closes:');
  for (const match of matches) {
    error(
      `- ${match.file}:${match.line} references #${match.issue}: ${match.text}`,
    );
  }
  error(
    'Please remove the completed TODO or update it so it no longer points to the closed issue.',
  );
  process.exitCode = 1;
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
