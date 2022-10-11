import { logger } from '../logger';
import * as options from './options';
import type { AllConfig, RenovateConfig, RenovateConfigStage } from './types';
import { mergeChildConfig } from './utils';

export { mergeChildConfig };

export function filterConfig(
  inputConfig: AllConfig,
  targetStage: RenovateConfigStage
): AllConfig {
  logger.trace({ config: inputConfig }, `filterConfig('${targetStage}')`);
  const outputConfig: RenovateConfig = { ...inputConfig };
  const stages: (string | undefined)[] = [
    'global',
    'repository',
    'package',
    'branch',
    'pr',
  ];
  const targetIndex = stages.indexOf(targetStage);
  for (const option of options.getOptions()) {
    const optionIndex = stages.indexOf(option.stage);
    if (optionIndex !== -1 && optionIndex < targetIndex) {
      delete outputConfig[option.name];
    }
  }
  return outputConfig;
}
