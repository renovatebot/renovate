import type { VulnerabilityPackage } from '../../../types';
import { normalizeDepName as normalizeForPip } from '../../datasource/pypi/common';

export function normalizeNamePerEcosystem({
  name,
  ecosystem,
}: VulnerabilityPackage): string {
  if (ecosystem === 'PIP') {
    return normalizeForPip(name);
  } else {
    return name;
  }
}
