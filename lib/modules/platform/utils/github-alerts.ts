import type { VulnerabilityPackage } from '../../../types';
import { normalizePythonDepName } from '../../datasource/pypi/common';

export function normalizeNamePerEcosystem({
  name,
  ecosystem,
}: VulnerabilityPackage): string {
  switch (ecosystem) {
    case 'pip':
      return normalizePythonDepName(name);
    default:
      return name;
  }
}
