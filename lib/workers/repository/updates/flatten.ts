import {
  filterConfig,
  getManagerConfig,
  mergeChildConfig,
} from '../../../config';
import type { RenovateConfig } from '../../../config/types';
import { getDefaultConfig } from '../../../modules/datasource';
import { get } from '../../../modules/manager';
import { detectSemanticCommits } from '../../../util/git/semantic';
import { applyPackageRules } from '../../../util/package-rules';
import { regEx } from '../../../util/regex';
import { parseUrl } from '../../../util/url';
import type { BranchUpgradeConfig } from '../../types';
import { generateBranchName } from './branch-name';

const upper = (str: string): string =>
  str.charAt(0).toUpperCase() + str.substring(1);

function sanitizeDepName(depName: string): string {
  return depName
    .replace('@types/', '')
    .replace('@', '')
    .replace(regEx(/\//g), '-')
    .replace(regEx(/\s+/g), '-')
    .replace(regEx(/-+/), '-')
    .toLowerCase();
}

export function applyUpdateConfig(input: BranchUpgradeConfig): any {
  const updateConfig = { ...input };
  delete updateConfig.packageRules;
  // TODO: Remove next line once #8075 is complete
  updateConfig.depNameSanitized = updateConfig.depName
    ? sanitizeDepName(updateConfig.depName)
    : undefined;
  updateConfig.newNameSanitized = updateConfig.newName
    ? sanitizeDepName(updateConfig.newName)
    : undefined;
  if (updateConfig.sourceUrl) {
    const parsedSourceUrl = parseUrl(updateConfig.sourceUrl);
    if (parsedSourceUrl?.pathname) {
      updateConfig.sourceRepoSlug = parsedSourceUrl.pathname
        .replace(regEx(/^\//), '') // remove leading slash
        .replace(regEx(/\//g), '-') // change slashes to hyphens
        .replace(regEx(/-+/g), '-'); // remove multiple hyphens
      updateConfig.sourceRepo = parsedSourceUrl.pathname.replace(
        regEx(/^\//),
        '',
      ); // remove leading slash
      updateConfig.sourceRepoOrg = updateConfig.sourceRepo.replace(
        regEx(/\/.*/g),
        '',
      ); // remove everything after first slash
      updateConfig.sourceRepoName = updateConfig.sourceRepo.replace(
        regEx(/.*\//g),
        '',
      ); // remove everything up to the last slash
    }
  }
  generateBranchName(updateConfig);
  return updateConfig;
}

export async function flattenUpdates(
  config: RenovateConfig,
  packageFiles: Record<string, any[]>,
): Promise<RenovateConfig[]> {
  const updates = [];
  const updateTypes = [
    'major',
    'minor',
    'patch',
    'pin',
    'digest',
    'lockFileMaintenance',
    'replacement',
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
      let depIndex = 0;
      for (const dep of packageFile.deps) {
        if (dep.updates.length) {
          const depConfig = mergeChildConfig(packageFileConfig, dep);
          delete depConfig.deps;
          depConfig.depIndex = depIndex; // used for autoreplace
          for (const update of dep.updates) {
            let updateConfig = mergeChildConfig(depConfig, update);
            delete updateConfig.updates;
            if (updateConfig.updateType) {
              updateConfig[`is${upper(updateConfig.updateType)}`] = true;
            }
            if (updateConfig.updateTypes) {
              updateConfig.updateTypes.forEach((updateType: string) => {
                updateConfig[`is${upper(updateType)}`] = true;
              });
            }
            // apply config from datasource
            const datasourceConfig = await getDefaultConfig(
              depConfig.datasource,
            );
            updateConfig = mergeChildConfig(updateConfig, datasourceConfig);
            updateConfig = applyPackageRules(updateConfig);
            // apply major/minor/patch/pin/digest
            updateConfig = mergeChildConfig(
              updateConfig,
              updateConfig[updateConfig.updateType],
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
        depIndex += 1;
      }
      if (
        get(manager, 'supportsLockFileMaintenance') &&
        packageFileConfig.lockFileMaintenance.enabled
      ) {
        // Apply lockFileMaintenance config before packageRules
        let lockFileConfig = mergeChildConfig(
          packageFileConfig,
          packageFileConfig.lockFileMaintenance,
        );
        lockFileConfig.updateType = 'lockFileMaintenance';
        lockFileConfig.isLockFileMaintenance = true;
        lockFileConfig = applyPackageRules(lockFileConfig);
        // Apply lockFileMaintenance and packageRules again
        lockFileConfig = mergeChildConfig(
          lockFileConfig,
          lockFileConfig.lockFileMaintenance,
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
          const lockfileRemediations = config.remediations as Record<
            string,
            Record<string, any>[]
          >;
          const remediations = lockfileRemediations?.[lockFile];
          if (remediations) {
            for (const remediation of remediations) {
              let updateConfig = mergeChildConfig(
                packageFileConfig,
                remediation,
              );
              updateConfig = mergeChildConfig(
                updateConfig,
                config.vulnerabilityAlerts,
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
  if (config.semanticCommits === 'auto') {
    const semanticCommits = await detectSemanticCommits();
    for (const update of updates) {
      update.semanticCommits = semanticCommits;
    }
  }
  return updates
    .filter((update) => update.enabled)
    .map(({ vulnerabilityAlerts, ...update }) => update)
    .map((update) => filterConfig(update, 'branch'));
}
