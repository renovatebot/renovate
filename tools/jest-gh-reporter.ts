import { AggregatedResult, BaseReporter, Context } from '@jest/reporters';
import { AssertionResult } from '@jest/test-result';
import { error, info } from '@actions/core';
import { GitHub } from '@actions/github';
import { Octokit } from '@octokit/rest';
import { getEnv } from './utils';

const name = 'jest-results';

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

const ignoreStates = new Set(['passed']);
const MAX_ANNOTATIONS = 50;

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
      if (getEnv('GITHUB_ACTIONS') !== 'true') {
        return;
      }

      const annotations: Octokit.ChecksCreateParamsOutputAnnotations[] = [];

      for (const suite of testResult.testResults) {
        for (const test of suite.testResults.filter(t =>
          ignoreStates.has(t.status)
        )) {
          if (annotations.length === MAX_ANNOTATIONS) {
            await this._createOrUpdate(testResult.success, annotations);
            annotations.length = 0;
            break;
          }
          annotations.push({
            title: test.fullName,
            message: test.failureMessages?.join('\n '),
            path: suite.testFilePath,
            annotation_level: getLevel(test),
            start_line: test.location?.line ?? 0,
            start_column: test.location?.column ?? 0,
            end_line: test.location?.line ?? 0,
          });
        }
      }
    } catch (e) {
      error(`Unexpected error: ${e}`);
    }
  }

  private async _createOrUpdate(
    status: boolean,
    annotations: Octokit.ChecksCreateParamsOutputAnnotations[]
  ): Promise<void> {
    if (this._api == null) {
      return;
    }
    const ref = getEnv('GITHUB_SHA');
    const [owner, repo] = getEnv('GITHUB_REPOSITORY').split('/');
    const checkArgs = {
      name,
      owner,
      repo,
    };
    const output: Octokit.ChecksCreateParamsOutput = {
      title: 'Jest test results',
      summary: '',
      annotations,
    };
    const checks = await this._api.checks.listForRef({
      ...checkArgs,
      ref,
      filter: 'latest',
    });
    if (checks.data.check_runs.length) {
      const [run] = checks.data.check_runs;
      info(`Update check run: ${run.id}`);

      await this._api.checks.update({
        ...checkArgs,
        check_run_id: run.id,
        completed_at: new Date().toISOString(),
        conclusion: status ? 'success' : 'failure',
        status: 'completed',
        output: { ...run.output, annotations },
      });

      return;
    }

    info(`Create check run`);
    await this._api.checks.create({
      ...checkArgs,
      head_sha: ref,
      completed_at: new Date().toISOString(),
      conclusion: status ? 'success' : 'failure',
      status: 'completed',
      output,
    });
  }
}

export = GitHubReporter;
