import { relative } from 'path';
import { error } from '@actions/core';
import { issueCommand } from '@actions/core/lib/command';
import { AggregatedResult, BaseReporter, Context } from '@jest/reporters';
import { AssertionResult, TestResult } from '@jest/test-result';
import stripAnsi from 'strip-ansi';
import { getEnv } from './utils';

const ROOT = process.cwd();

type Level = 'debug' | 'warning' | 'error';

function getCmd(test: AssertionResult): Level {
  switch (test.status) {
    case 'failed':
      return 'error';
    case 'pending':
    case 'todo':
      return 'warning';
    default:
      return 'debug';
  }
}

function getPath(suite: TestResult): string {
  return relative(ROOT, suite.testFilePath).replace(/\\/g, '/');
}

const ignoreStates = new Set(['passed', 'pending']);
const lineRe = /\.spec\.ts:(?<line>\d+):(?<col>\d+)\)/;

function getPos(msg: string): Record<string, string> {
  const pos = lineRe.exec(msg);
  if (!pos || !pos.groups) {
    return {};
  }

  const line = pos.groups.line;
  const col = pos.groups.col;

  return {
    line,
    col,
  };
}

class GitHubReporter extends BaseReporter {
  // eslint-disable-next-line class-methods-use-this
  onRunComplete(_contexts: Set<Context>, testResult: AggregatedResult): void {
    try {
      if (getEnv('GITHUB_ACTIONS') !== 'true') {
        return;
      }

      for (const suite of testResult.testResults.filter((s) => !s.skipped)) {
        const file = getPath(suite);
        for (const test of suite.testResults.filter(
          (t) => !ignoreStates.has(t.status)
        )) {
          const message =
            stripAnsi(test.failureMessages?.join('\n ')) ||
            `test status: ${test.status}`;
          const pos = getPos(message);
          const cmd = getCmd(test);

          issueCommand(cmd, { file, ...pos }, message);
        }
      }
    } catch (e) {
      error(`Unexpected error: ${(e as Error).toString()}`);
    }
  }
}

export = GitHubReporter;
