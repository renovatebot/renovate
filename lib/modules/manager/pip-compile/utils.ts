import upath from 'upath';
import { logger } from '../../../logger';

export function inferCommandExecDir(
  fileName: string,
  outputFile: string | undefined,
): string {
  if (!outputFile) {
    // implicit output file is in the same directory where command was executed
    return upath.normalize(upath.dirname(fileName));
  }
  if (upath.normalize(outputFile).startsWith('..')) {
    throw new Error(
      `Cannot infer command execution directory from path ${outputFile}`,
    );
  }
  if (upath.basename(outputFile) !== upath.basename(fileName)) {
    throw new Error(
      `Output file name mismatch: ${upath.basename(outputFile)} vs ${upath.basename(fileName)}`,
    );
  }
  const outputFileDir = upath.normalize(upath.dirname(outputFile));
  let commandExecDir = upath.normalize(upath.dirname(fileName));

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
        outputFile,
        fileName,
      },
      `pip-compile: command was not executed in repository root`,
    );
  }
  return commandExecDir;
}
