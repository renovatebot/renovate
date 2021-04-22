import {
  filterConfig,
  getManagerConfig,
  mergeChildConfig,
} from '../../../config';
import type { RenovateConfig } from '../../../config/types';
import { getDefaultConfig } from '../../../datasource';
import { get } from '../../../manager';
import { applyPackageRules } from '../../../util/package-rules';
import type { BranchUpgradeConfig } from '../../types';
import { generateBranchName } from './branch-name';

const upper = (str: string): string =>
  str.charAt(0).toUpperCase() + str.substr(1);

export function applyUpdateConfig(input: BranchUpgradeConfig): any {
  const updateConfig = { ...input };
  delete updateConfig.packageRules;
  // TODO: Remove next line once #8075 is complete
  updateConfig.depNameSanitized = updateConfig.depName
    ? updateConfig.depName
        .replace('@types/', '')
        .replace('@', '')
        .replace(/\//g, '-')
        .replace(/\s+/g, '-')
        .replace(/-+/, '-')
        .toLowerCase()
    : undefined;
  generateBranchName(updateConfig);
  return updateConfig;
}

export async function flattenUpdates(
  config: RenovateConfig,
  packageFiles: Record<string, any[]>
): Promise<RenovateConfig[]> {
  const updates = [];
  const updateTypes = [
    'major',
    'minor',
    'patch',
    'pin',
    'digest',
    'lockFileMaintenance',
  ];
  for (const [manager, files] of Object.entries(packageFiles)) {
    const managerConfig = getManagerConfig(config, manager);
    for (const packageFile of files) {
      const packageFileConfig = mergeChildConfig(managerConfig, packageFile);
      const packagePath = packageFile.packageFile?.split('/');
      // istanbul ignore else: can never happen and would throw
      if (packagePath.length > 0) {
        packagePath.splice(-1, 1);
      }
      if (packagePath.length > 0) {
        packageFileConfig.parentDir = packagePath[packagePath.length - 1];
        packageFileConfig.packageFileDir = packagePath.join('/');
      } else {
        packageFileConfig.parentDir = '';
        packageFileConfig.packageFileDir = '';
      }
      for (const dep of packageFile.deps) {
        if (dep.updates.length) {
          const depConfig = mergeChildConfig(packageFileConfig, dep);
          delete depConfig.deps;
          for (const update of dep.updates) {
            let updateConfig = mergeChildConfig(depConfig, update);
            delete updateConfig.updates;
            updateConfig.newVersion =
              updateConfig.newVersion || updateConfig.newValue;
            if (updateConfig.updateType) {
              updateConfig[`is${upper(updateConfig.updateType)}`] = true;
            }
            if (updateConfig.updateTypes) {
              updateConfig.updateTypes.forEach((updateType) => {
                updateConfig[`is${upper(updateType)}`] = true;
              });
            }
            // apply config from datasource
            const datasourceConfig = await getDefaultConfig(
              depConfig.datasource
            );
            updateConfig = mergeChildConfig(updateConfig, datasourceConfig);
            updateConfig = applyPackageRules(updateConfig);
            // apply major/minor/patch/pin/digest
            updateConfig = mergeChildConfig(
              updateConfig,
              updateConfig[updateConfig.updateType]
            );
            for (const updateType of updateTypes) {
              delete updateConfig[updateType];
            }
            // Apply again in case any were added by the updateType config
            updateConfig = applyPackageRules(updateConfig);
            updateConfig = applyUpdateConfig(updateConfig);
            updateConfig.baseDeps = packageFile.deps;
            update.branchName = updateConfig.branchName;
            updates.push(updateConfig);
          }
        }
      }
      if (
        get(manager, 'supportsLockFileMaintenance') &&
        packageFileConfig.lockFileMaintenance.enabled
      ) {
        // Apply lockFileMaintenance config before packageRules
        let lockFileConfig = mergeChildConfig(
          packageFileConfig,
          packageFileConfig.lockFileMaintenance
        );
        lockFileConfig.updateType = 'lockFileMaintenance';
        lockFileConfig = applyPackageRules(lockFileConfig);
        // Apply lockFileMaintenance and packageRules again
        lockFileConfig = mergeChildConfig(
          lockFileConfig,
          lockFileConfig.lockFileMaintenance
        );
        lockFileConfig = applyPackageRules(lockFileConfig);
        // Remove unnecessary objects
        for (const updateType of updateTypes) {
          delete lockFileConfig[updateType];
        }
        delete lockFileConfig.packageRules;
        delete lockFileConfig.deps;
        generateBranchName(lockFileConfig);
        updates.push(lockFileConfig);
      }
      if (get(manager, 'updateLockedDependency')) {
        for (const lockFile of packageFileConfig.lockFiles || []) {
          const remediations = config.remediations?.[lockFile];
          if (remediations) {
            for (const remediation of remediations) {
              let updateConfig = mergeChildConfig(
                packageFileConfig,
                remediation
              );
              updateConfig = mergeChildConfig(
                updateConfig,
                config.vulnerabilityAlerts
              );
              delete updateConfig.vulnerabilityAlerts;
              updateConfig.isVulnerabilityAlert = true;
              updateConfig.isRemediation = true;
              updateConfig.lockFile = lockFile;
              updateConfig.currentValue = updateConfig.currentVersion;
              updateConfig.newValue = updateConfig.newVersion;
              updateConfig = applyUpdateConfig(updateConfig);
              updateConfig.enabled = true;
              updates.push(updateConfig);
            }
          }
        }
      }
    }
  }
  return updates
    .filter((update) => update.enabled)
    .map(({ vulnerabilityAlerts, ...update }) => update)
    .map((update) => filterConfig(update, 'branch'));
}
