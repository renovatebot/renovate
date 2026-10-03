import { regEx } from '../../../util/regex.ts';
import type { PackageDependency } from '../types.ts';

const bomPrefix = 'bom:';
const localPrefixes = ['//', './', '../'];
const coordinatePartRegex = regEx(/^[A-Za-z0-9_.-]+$/);

export function parseCoordinate(value: string): PackageDependency | null {
  let coordinate = value.trim();
  if (coordinate.startsWith(bomPrefix)) {
    coordinate = coordinate.slice(bomPrefix.length).trim();
  }

  if (coordinate.startsWith('$')) {
    return { depName: coordinate, skipReason: 'contains-variable' };
  }

  if (localPrefixes.some((prefix) => coordinate.startsWith(prefix))) {
    return { depName: coordinate, skipReason: 'local-dependency' };
  }

  const [withoutPackaging] = coordinate.split('@');
  const parts = withoutPackaging.split(':');
  if (parts.length < 2 || parts.length > 4) {
    return null;
  }

  const [group, artifact, version] = parts;
  if (!coordinatePartRegex.test(group) || !coordinatePartRegex.test(artifact)) {
    return null;
  }

  const depName = `${group}:${artifact}`;
  if (!version) {
    return { depName, skipReason: 'unspecified-version' };
  }

  if (version.startsWith('$')) {
    return { depName, skipReason: 'contains-variable' };
  }

  return { depName, currentValue: version };
}
