import type { DependencyBetweenFiles, PipCompileArgs } from './types';

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

// https://packaging.python.org/en/latest/specifications/name-normalization/
export function normalizeDepName(name: string): string {
  return name.replace(/[-_.]+/g, '-').toLowerCase();
}
