import upath from 'upath';
import { logger } from '../../../logger';

export function inferCommandExecDir(
  outputFilePath: string,
  outputFileArg: string | undefined,
): string {
  if (!outputFileArg) {
    // implicit output file is in the same directory where command was executed
    return upath.normalize(upath.dirname(outputFilePath));
  }
  if (upath.normalize(outputFileArg).startsWith('..')) {
    throw new Error(
      `Cannot infer command execution directory from path ${outputFileArg}`,
    );
  }
  if (upath.basename(outputFileArg) !== upath.basename(outputFilePath)) {
    throw new Error(
      `Output file name mismatch: ${upath.basename(outputFileArg)} vs ${upath.basename(outputFilePath)}`,
    );
  }
  const outputFileDir = upath.normalize(upath.dirname(outputFileArg));
  let commandExecDir = upath.normalize(upath.dirname(outputFilePath));

  for (const dir of outputFileDir.split('/').reverse()) {
    if (commandExecDir.endsWith(dir)) {
      commandExecDir = upath.join(commandExecDir.slice(0, -dir.length), '.');
      // outputFileDir = upath.join(outputFileDir.slice(0, -dir.length), '.');
    } else {
      break;
    }
  }
  commandExecDir = upath.normalizeTrim(commandExecDir);
  if (commandExecDir !== '.') {
    logger.debug(
      {
        commandExecDir,
        outputFileArg,
        outputFilePath,
      },
      `pip-compile: command was not executed in repository root`,
    );
  }
  return commandExecDir;
}
