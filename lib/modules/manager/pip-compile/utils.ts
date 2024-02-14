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
  if (upath.basename(outputFile) !== upath.basename(fileName)) {
    throw new Error(`Output file name mismatch: ${fileName} vs ${outputFile}`);
  }
  let commandExecDir = upath.normalize(upath.dirname(fileName));
  let outputFileDir = upath.normalize(upath.dirname(outputFile));
  for (const dir of outputFile.split('/').reverse()) {
    if (commandExecDir.endsWith(dir)) {
      commandExecDir = upath.join(commandExecDir.slice(0, -dir.length), '.');
      outputFileDir = upath.join(outputFileDir.slice(0, -dir.length), '.');
    }
  }
  if (outputFileDir.split('/').every((d) => d === '..')) {
    commandExecDir = upath.join(commandExecDir, outputFileDir);
  }
  if (commandExecDir.endsWith('/')) {
    commandExecDir = upath.join(commandExecDir, '.');
  }
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
