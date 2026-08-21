import type { PackageDependency } from '../../../types.ts';
import type { NpmManagerData } from '../../types.ts';

export function setNodeCommitTopic(
  dep: PackageDependency<NpmManagerData>,
): void {
  // This is a special case for Node.js to group it together with other managers
  if (dep.depName === 'node') {
    dep.commitMessageTopic = 'Node.js';
  }
}
