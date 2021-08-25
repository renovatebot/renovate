const { error } = require('@actions/core');
const { issueCommand } = require('@actions/core/lib/command');
const { BaseReporter } = require('@jest/reporters');
const stripAnsi = require('strip-ansi');
const { relative } = require('upath');

const ROOT = process.cwd();

/**
 * @param {string} key
 */
function getEnv(key) {
  return process.env[key] ?? '';
}

/**
 * @param {import('@jest/test-result').AssertionResult} test
 */
function getCmd(test) {
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

/**
 * @param {import('@jest/reporters').TestResult} suite
 */
function getPath(suite) {
  return relative(ROOT, suite.testFilePath).replace(/\\/g, '/');
}

const ignoreStates = new Set(['passed', 'pending']);
const lineRe = /\.spec\.ts:(?<line>\d+):(?<col>\d+)\)/;

/**
 * @param {string} msg
 */
function getPos(msg) {
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
  /**
   * @override
   * @param {Set<import('@jest/reporters').Context>} _contexts
   * @param {import('@jest/reporters').AggregatedResult} testResult
   * @returns
   */
  // eslint-disable-next-line class-methods-use-this
  onRunComplete(_contexts, testResult) {
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
      error(`Unexpected error: ${e.toString()}`);
    }
  }
}

module.exports = GitHubReporter;
