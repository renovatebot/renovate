import { logger } from '../../../logger/index.ts';
import type { RangeStrategy } from '../../../types/index.ts';
import type { RangeConfig } from '../types.ts';
import type { ComposerManagerData } from './types.ts';

export function getRangeStrategy(config: RangeConfig): RangeStrategy {
  const { managerData = {}, currentValue, rangeStrategy } = config;
  const { composerJsonType } = managerData as ComposerManagerData;
  const isComplexRange = currentValue?.includes(' || ') ?? false;
  if (rangeStrategy === 'bump' && isComplexRange) {
    logger.debug(
      { currentValue },
      'Replacing bump strategy for complex range with widen',
    );
    return 'widen';
  }
  if (rangeStrategy !== 'auto') {
    return rangeStrategy!;
  }
  if (
    isComplexRange ||
    (composerJsonType && ['typo3-cms-extension'].includes(composerJsonType))
  ) {
    return 'widen';
  }
  return 'update-lockfile';
}
