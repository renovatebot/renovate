import { Graph, topologicalSort } from 'graph-data-structure';
import upath from 'upath';
import { logger } from '../../../logger';
import type { PackageFile } from '../types';
import type { DependencyBetweenFiles, PipCompileArgs } from './types';

export function sortPackageFiles(
  depsBetweenFiles: DependencyBetweenFiles[],
  packageFiles: Map<string, PackageFile>,
): PackageFile[] {
  const result: PackageFile[] = [];
  const graph = new Graph();
  depsBetweenFiles.forEach(({ sourceFile, outputFile }) => {
    graph.addEdge(sourceFile, outputFile);
  });
  const sorted = topologicalSort(graph);
  for (const file of sorted) {
    if (packageFiles.has(file)) {
      const packageFile = packageFiles.get(file)!;
      const sortedLockFiles = [];
      // TODO(not7cd): this needs better test case
      for (const lockFile of packageFile.lockFiles!) {
        if (sorted.includes(lockFile)) {
          sortedLockFiles.push(lockFile);
        }
      }
      packageFile.lockFiles = sortedLockFiles;
      result.push(packageFile);
    }
  }
  // istanbul ignore if: should never happen
  if (result.length !== packageFiles.size) {
    throw new Error('Topological sort failed to include all package files');
  }
  return result;
}

export function generateMermaidGraph(
  depsBetweenFiles: DependencyBetweenFiles[],
  lockFileArgs: Map<string, PipCompileArgs>,
): string {
  const lockFiles = [];
  for (const lockFile of lockFileArgs.keys()) {
    // TODO: add extra args to the lock file ${extraArgs ? '\n' + extraArgs : ''}
    // const extraArgs = pipCompileArgs.extra
    //   ?.map((v) => '--extra=' + v)
    //   .join('\n');
    lockFiles.push(`  ${lockFile}[[${lockFile}]]`);
  }
  const edges = depsBetweenFiles.map(({ sourceFile, outputFile, type }) => {
    return `  ${sourceFile} -${type === 'constraint' ? '.' : ''}-> ${outputFile}`;
  });
  return `graph TD\n${lockFiles.join('\n')}\n${edges.join('\n')}`;
}

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
