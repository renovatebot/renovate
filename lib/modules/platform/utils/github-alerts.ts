import { normalizeDepName as normalizeForPip } from '../../datasource/pypi/common';

export function normalizeNamePerEcosystem(
  name: string,
  ecosystem: string,
): string {
  if (ecosystem.toLowerCase() === 'pip') {
    return normalizeForPip(name);
  } else {
    return name;
  }
}
