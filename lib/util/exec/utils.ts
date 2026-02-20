import {
  isBoolean,
  isNonEmptyStringAndNotWhitespace,
  isString,
} from '@sindresorhus/is';
import { join } from 'shlex';
import { getCustomEnv, getUserEnv } from '../env.ts';
import { getChildProcessEnv } from './env.ts';
import type { CommandWithOptions, ExecOptions } from './types.ts';

export function getChildEnv({
  extraEnv,
  env: forcedEnv = {},
}: Pick<ExecOptions, 'env' | 'extraEnv'> = {}): Record<string, string> {
  const globalConfigEnv = getCustomEnv();
  const userConfiguredEnv = getUserEnv();

  const inheritedKeys: string[] = [];
  for (const [key, val] of Object.entries(extraEnv ?? {})) {
    if (isString(val)) {
      inheritedKeys.push(key);
    }
  }

  const parentEnv = getChildProcessEnv(inheritedKeys);
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
