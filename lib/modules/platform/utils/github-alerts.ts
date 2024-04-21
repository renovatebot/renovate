import type { VulnerabilityPackage } from '../../../types';
import { normalizePythonDepName } from '../../datasource/pypi/common';

export function normalizeNamePerEcosystem({
  name,
  ecosystem,
}: VulnerabilityPackage): string {
  if (ecosystem === 'PIP') {
    return normalizePythonDepName(name);
  } else {
    return name;
  }
}
