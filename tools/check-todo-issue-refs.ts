import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const closingKeywordRe =
  /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)(?:\s*:\s*|\s+)(?:(?:renovatebot\/renovate)?#|https:\/\/github\.com\/renovatebot\/renovate\/(?:issues|discussions)\/)(?<issue>\d+)\b/gi;
const todoIssueRefRe =
  /\bTODO\b.*(?:(?:renovatebot\/renovate)?#|https:\/\/github\.com\/renovatebot\/renovate\/(?:issues|discussions)\/)(?<issue>\d+)\b/i;
const fencedCodeBlockRe = /(?:^|\n)(?:```|~~~)[\s\S]*?(?:\n(?:```|~~~)(?=\n|$)|$)/g;
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

function getPullRequestText(): string {
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
      readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'),
    ) as GitHubPullRequestEvent;
    return extractPullRequestTextFromGitHubEvent(event);
  }

  return '';
}

function gitGrepTodos(): string {
  const result = spawnSync(
    'git',
    [
      'grep',
      '-n',
      '-I',
      '-E',
      'TODO.*((renovatebot/renovate)?#[0-9][0-9]*|github\\.com/renovatebot/renovate/(issues|discussions)/[0-9][0-9]*)',
      '--',
      '.',
    ],
    { encoding: 'utf-8' },
  );

  if (result.status === 1) {
    return '';
  }

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'git grep failed');
  }

  return result.stdout;
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

function main(): void {
  const matches = checkTodoIssueRefs(getPullRequestText(), gitGrepTodos());

  if (matches.length === 0) {
    return;
  }

  console.error(
    'Found TODO comments that still reference issues this PR closes:',
  );
  for (const match of matches) {
    console.error(
      `- ${match.file}:${match.line} references #${match.issue}: ${match.text}`,
    );
  }
  console.error(
    'Please remove the completed TODO or update it so it no longer points to the closed issue.',
  );
  process.exitCode = 1;
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
