import { PackageRule, mergeChildConfig } from '../../../config';
import { logger } from '../../../logger';

export function flattenPackageRules(
  packageRules: PackageRule[]
): PackageRule[] {
  const res: PackageRule[] = [];
  if (!packageRules?.length) {
    return res;
  }
  for (const rule of packageRules) {
    if (rule.packageRules?.length) {
      logger.debug('Flattening nested packageRules');
      for (const subrule of rule.packageRules) {
        const combinedRule = mergeChildConfig(rule, subrule);
        delete combinedRule.packageRules;
        res.push(combinedRule);
      }
    } else {
      res.push(rule);
    }
  }
  return res;
}
