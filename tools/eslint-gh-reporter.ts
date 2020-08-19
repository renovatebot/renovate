import { relative } from 'path';
import { error } from '@actions/core';
import { issueCommand } from '@actions/core/lib/command';
import { CLIEngine, Linter } from 'eslint';
import stripAnsi from 'strip-ansi';

const ROOT = process.cwd();

type Level = 'debug' | 'warning' | 'error';

function getCmd(severity: Linter.Severity): Level {
  switch (severity) {
    case 2:
      return 'error';
    case 1:
      return 'warning';
    default:
      return 'debug';
  }
}

function getPath(path: string): string {
  return relative(ROOT, path).replace(/\\/g, '/');
}

const formatter: CLIEngine.Formatter = (results) => {
  try {
    for (const { filePath, messages } of results) {
      const file = getPath(filePath);
      for (const { severity, line, column, ruleId, message } of messages) {
        const cmd = getCmd(severity);
        const pos = { line: line.toString(), col: column.toString() };
        issueCommand(
          cmd,
          { file, ...pos },
          stripAnsi(`[${ruleId}] ${message}`)
        );
      }
    }
  } catch (e) {
    error(`Unexpected error: ${(e as Error).toString()}`);
  }
  return '';
};

export = formatter;
