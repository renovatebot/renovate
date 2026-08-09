import {
  isBoolean,
  isNonEmptyStringAndNotWhitespace,
  isString,
} from '@sindresorhus/is';
import { join, split } from 'shlex';
import upath from 'upath';
import { getCustomEnv, getUserEnv } from '../env.ts';
import { getChildProcessEnv } from './env.ts';
import type { CommandWithOptions, ExecOptions } from './types.ts';

export function getChildEnv(
  { extraEnv, env: forcedEnv = {} }: Pick<ExecOptions, 'env' | 'extraEnv'> = {},
  commandName?: string,
): Record<string, string> {
  const globalConfigEnv = getCustomEnv();
  const userConfiguredEnv = getUserEnv();

  const inheritedKeys: string[] = [];
  for (const [key, val] of Object.entries(extraEnv ?? {})) {
    if (isString(val)) {
      inheritedKeys.push(key);
    }
  }

  const parentEnv = getChildProcessEnv(inheritedKeys, commandName);
  const combinedEnv = {
    ...extraEnv,
    ...parentEnv,
    ...globalConfigEnv,
    ...userConfiguredEnv,
    ...forcedEnv,
  };

  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(combinedEnv)) {
    if (isString(val)) {
      result[key] = `${val}`;
    }
  }

  return result;
}

export function isCommandWithOptions(cmd: unknown): cmd is CommandWithOptions {
  if (!(typeof cmd === 'object' && cmd !== null && 'command' in cmd)) {
    return false;
  }

  if (!Array.isArray(cmd.command)) {
    return false;
  }

  if (!cmd.command.length) {
    return false;
  }

  if (cmd.command.some((v) => !isString(v))) {
    return false;
  }

  if ('ignoreFailure' in cmd && !isBoolean(cmd.ignoreFailure)) {
    return false;
  }

  if (
    'shell' in cmd &&
    !(isBoolean(cmd.shell) || isNonEmptyStringAndNotWhitespace(cmd.shell))
  ) {
    return false;
  }

  return true;
}

export function asRawCommand(cmd: string | CommandWithOptions): string {
  if (isCommandWithOptions(cmd)) {
    return join(cmd.command);
  }

  return cmd;
}

export function asRawCommands(
  cmds: string | (string | CommandWithOptions)[],
): string[] {
  if (isString(cmds)) {
    return [cmds];
  }
  return cmds.map((cmd) => asRawCommand(cmd));
}

/**
 * Derives the name of the executable being run, from the first of the given
 * commands, stripped of any path and arguments, e.g. `/usr/bin/git status` ->
 * `git`. Used to give the child process its own OpenTelemetry `service.name`,
 * distinct from Renovate's.
 */
export function getExecutableName(
  cmds: string | (string | CommandWithOptions)[],
): string | undefined {
  const [firstCommand] = asRawCommands(cmds);
  if (!firstCommand) {
    return undefined;
  }
  const [executable] = split(firstCommand);
  return executable ? upath.basename(executable) : undefined;
}
