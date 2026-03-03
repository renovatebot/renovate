import type { VulnerabilityPackage } from '../../../types/index.ts';
import { normalizePythonDepName } from '../../datasource/pypi/common.ts';

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
