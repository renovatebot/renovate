import { BranchUpgradeConfig } from '../../common';

/* eslint-disable no-param-reassign */
export function addUpdateMeta(update: BranchUpgradeConfig): void {
  // extract parentDir and baseDir from packageFile
  if (update.packageFile) {
    const packagePath = update.packageFile.split('/');
    if (packagePath.length > 0) {
      packagePath.splice(-1, 1);
    }
    if (packagePath.length > 0) {
      update.parentDir = packagePath[packagePath.length - 1];
      update.baseDir = packagePath.join('/');
    } else {
      update.parentDir = '';
      update.baseDir = '';
    }
  }
  // Massage legacy vars just in case
  update.currentVersion = update.currentValue;
  update.newVersion = update.newVersion || update.newValue;
  const upper = (str: string): string =>
    str.charAt(0).toUpperCase() + str.substr(1);
  if (update.updateType) {
    update[`is${upper(update.updateType)}`] = true;
  }
}
