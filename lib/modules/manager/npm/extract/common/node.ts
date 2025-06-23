import type { PackageDependency } from '../../../types';
import type { NpmManagerData } from '../../types';

export function setNodeCommitTopic(
  dep: PackageDependency<NpmManagerData>,
): void {
  // This is a special case for Node.js to group it together with other managers
  if (dep.depName === 'node') {
    dep.commitMessageTopic = 'Node.js';
  }
}
