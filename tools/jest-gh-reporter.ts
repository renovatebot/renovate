import { AggregatedResult, BaseReporter, Context } from '@jest/reporters';
import { AssertionResult, TestResult } from '@jest/test-result';
import { error, info } from '@actions/core';
import { GitHub } from '@actions/github';
import { Octokit } from '@octokit/rest';
import { relative } from 'path';
import stripAnsi from 'strip-ansi';
import { getEnv } from './utils';

const name = 'jest-results';
const ROOT = process.cwd();

type Level = 'notice' | 'warning' | 'failure';

function getLevel(test: AssertionResult): Level {
  switch (test.status) {
    case 'failed':
      return 'failure';
    case 'pending':
    case 'todo':
      return 'warning';
    default:
      return 'notice';
  }
}

function getPath(suite: TestResult): string {
  return relative(ROOT, suite.testFilePath).replace(/\\/g, '/');
}

const ignoreStates = new Set(['passed']);
const MAX_ANNOTATIONS = 50;
const lineRe = /\.spec\.ts:(?<line>\d+):(?<col>\d+)\)/;

function getPos(
  msg: string
): Pick<
  Octokit.ChecksCreateParamsOutputAnnotations,
  'end_column' | 'end_line' | 'start_column' | 'start_line'
> {
  const pos = lineRe.exec(msg);
  if (!pos || !pos.groups) {
    return { start_line: 1, end_line: 1 };
  }

  const line = parseInt(pos.groups.line, 10);
  const col = parseInt(pos.groups.col, 10);

  return {
    start_line: line,
    end_line: line,
    start_column: col,
    end_column: col,
  };
}

class GitHubReporter extends BaseReporter {
  private readonly _api: GitHub | null;

  constructor() {
    super();
    try {
      this._api = new GitHub(getEnv('GITHUB_TOKEN'));
    } catch (e) {
      error(`Unexpected error: ${e}`);
      this._api = null;
    }
  }

  async onRunComplete(
    _contexts: Set<Context>,
    testResult: AggregatedResult
  ): Promise<void> {
    try {
      if (getEnv('GITHUB_ACTIONS') !== 'true' || !this._api) {
        return;
      }

      const annotations: Octokit.ChecksCreateParamsOutputAnnotations[] = [];
      const success = testResult.numFailedTests === 0;

      for (const suite of testResult.testResults) {
        const path = getPath(suite);
        for (const test of suite.testResults.filter(
          t => !ignoreStates.has(t.status)
        )) {
          if (annotations.length === MAX_ANNOTATIONS) {
            await this._createOrUpdate(success, annotations);
            annotations.length = 0;
            break;
          }
          const message =
            stripAnsi(test.failureMessages?.join('\n ')) ||
            `test status: ${test.status}`;
          const pos = getPos(message);

          annotations.push({
            title: test.fullName.substr(0, 255),
            message,
            path,
            annotation_level: getLevel(test),
            ...pos,
          });
        }
      }

      if (annotations.length) {
        await this._createOrUpdate(success, annotations);
      }
    } catch (e) {
      error(`Unexpected error: ${e}`);
    }
  }

  private async _createOrUpdate(
    success: boolean,
    annotations: Octokit.ChecksCreateParamsOutputAnnotations[]
  ): Promise<void> {
    if (!this._api) {
      return;
    }
    const run_id = parseInt(getEnv('GITHUB_RUN_ID'), 10);
    const [owner, repo] = getEnv('GITHUB_REPOSITORY').split('/');
    const checkArgs = {
      owner,
      repo,
    };
    const { data: wf } = await this._api.actions.getWorkflowRun({
      owner,
      repo,
      run_id,
    });
    const ref = wf.head_sha;

    info(`repo: ${owner} / ${repo}`);
    info(`sha: ${ref}`);

    const output: Octokit.ChecksUpdateParamsOutput = {
      summary: 'Jest test results',
    };
    if (annotations.length) {
      output.annotations = annotations;
    }

    const { data } = await this._api.checks.listForRef({
      ...checkArgs,
      check_name: name,
      ref,
      filter: 'latest',
    });
    const check = data.check_runs.find(c => c.name === name);
    if (check) {
      info(`Update check run: ${check.name} (${check.id}) ${check.html_url}`);

      await this._api.checks.update({
        ...checkArgs,
        check_run_id: check.id,
        completed_at: new Date().toISOString(),
        conclusion:
          success && check.conclusion === 'success' ? 'success' : 'failure',
        output,
      });

      return;
    }

    info(`Create check run`);
    await this._api.checks.create({
      ...checkArgs,
      name,
      head_sha: ref,
      completed_at: new Date().toISOString(),
      conclusion: success ? 'success' : 'failure',
      output: { ...output, title: 'Jest' },
    });
  }
}

export = GitHubReporter;
