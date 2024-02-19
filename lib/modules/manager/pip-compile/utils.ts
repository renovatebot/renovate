import Graph from 'graph-data-structure';
import type { PackageFile } from '../types';
import type { DependencyBetweenFiles, PipCompileArgs } from './types';

export function sortPackageFiles(
  depsBetweenFiles: DependencyBetweenFiles[],
  packageFiles: Map<string, PackageFile>,
): PackageFile[] {
  const result: PackageFile[] = [];
  const graph: ReturnType<typeof Graph> = Graph();
  depsBetweenFiles.forEach(({ sourceFile, outputFile }) => {
    graph.addEdge(sourceFile, outputFile);
  });
  const sorted = graph.topologicalSort();
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
