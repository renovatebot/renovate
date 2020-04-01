import { ConsoleBuffer } from '@jest/console';
import {
  AggregatedResult,
  Test,
  BaseReporter,
  Context,
  TestResult,
} from '@jest/reporters';
import { AssertionResult } from '@jest/test-result';
import { error, warning, info } from '@actions/core';
import { GitHub } from '@actions/github';
import { Octokit } from '@octokit/rest';
import { getEnv } from './utils';

const name = 'jest-results';

type Level = 'notice' | 'warning' | 'failure';

function getLevel(test: AssertionResult): Level {
  switch (test.status) {
    case 'failed':
      return 'failure';
    case 'skipped':
      return 'warning';
    default:
      return 'notice';
  }
}

class GitHubReporter extends BaseReporter {
  private consoleLogs: { filePath: string; logs: ConsoleBuffer }[];

  onTestResult(_data: Test, result: TestResult): void {
    if (getEnv('GITHUB_ACTIONS') !== 'true') {
      info('');
      return;
    }
    // Catch console logs per test
    // TestResult will only contain console logs if Jest is run with verbose=false
    if (result.console) {
      this.consoleLogs.push({
        filePath: result.testFilePath,
        logs: result.console,
      });
    }
  }

  // eslint-disable-next-line class-methods-use-this
  async onRunComplete(
    _contexts: Set<Context>,
    testResult: AggregatedResult
  ): Promise<void> {
    try {
      if (getEnv('GITHUB_ACTIONS') !== 'true') {
        return;
      }
      const ref = getEnv('GITHUB_SHA');
      const [owner, repo] = getEnv('GITHUB_REPOSITORY').split('/');
      const checkArgs = {
        name,
        owner,
        repo,
      };

      const api = new GitHub(getEnv('GITHUB_TOKEN'));
      const output: Octokit.ChecksCreateParamsOutput = {
        title: 'Jest test results',
        summary: '',
        annotations: [],
      };

      for (const suite of testResult.testResults) {
        for (const test of suite.testResults) {
          output.annotations.push({
            title: test.fullName,
            message: test.failureMessages?.join('\n '),
            path: suite.testFilePath,
            annotation_level: getLevel(test),
            start_line: test.location.line,
            start_column: test.location.column,
            end_line: test.location.line,
          });
        }
      }

      const checks = await api.checks.listForRef({
        ...checkArgs,
        ref,
        filter: 'latest',
      });
      if (checks.data.total_count && checks.data.check_runs.length) {
        const [run] = checks.data.check_runs;
        if (run.conclusion === 'failure' && testResult.success) {
          warning('Skipping report, because other run failed');
          return;
        }
      }

      await api.checks.create({
        ...checkArgs,
        head_sha: ref,
        completed_at: new Date().toISOString(),
        conclusion: testResult.success ? 'success' : 'failure',
        status: 'completed',
        output,
      });
    } catch (e) {
      error(`Unexpected error: ${e}`);
    }
  }
}

export = GitHubReporter;
