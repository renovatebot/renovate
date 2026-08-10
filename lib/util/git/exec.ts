import { coerceArray, deduplicateArray } from '../array.ts';
import { exec } from '../exec/index.ts';
import type { ExecOptions } from '../exec/types.ts';
import { getChildEnv } from '../exec/utils.ts';
import { coerceObject } from '../object.ts';
import { regEx } from '../regex.ts';
import { getGitEnvironmentVariables } from './auth.ts';

const gitConfigEnvironmentVariableRegex = regEx(
  /^GIT_CONFIG_(?:COUNT|KEY_\d+|VALUE_\d+)$/,
);

function getGitExecOptions(
  execOptions: ExecOptions,
  hostTypes: readonly string[],
): ExecOptions {
  const childEnv = getChildEnv(execOptions);
  const environmentVariables = getGitEnvironmentVariables(childEnv, hostTypes);
  const gitConfigEnv: Record<string, string> = {};

  for (const [key, value] of Object.entries(environmentVariables)) {
    if (gitConfigEnvironmentVariableRegex.test(key)) {
      gitConfigEnv[key] = value;
    }
  }

  const gitConfigKeys = Object.keys(gitConfigEnv);
  if (!gitConfigKeys.length) {
    return { ...execOptions };
  }

  return {
    ...execOptions,
    env: {
      ...execOptions.env,
      ...gitConfigEnv,
    },
    ...(execOptions.docker && {
      docker: {
        ...execOptions.docker,
        envVars: deduplicateArray([
          ...coerceArray(execOptions.docker.envVars),
          ...gitConfigKeys,
        ]),
      },
    }),
  };
}

export function withGitEnvironment(
  hostTypes: readonly string[] = [],
): typeof exec {
  return (command, execOptions) =>
    exec(command, getGitExecOptions(coerceObject(execOptions), hostTypes));
}
