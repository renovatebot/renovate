import { UpdateDependencyConfig } from '../common';
import { updateAtPosition } from '../maven/update';

export function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string | null {
  return updateAtPosition(fileContent, upgrade);
}
