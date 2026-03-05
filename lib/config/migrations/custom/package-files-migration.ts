import { isArray, isNonEmptyObject, isString } from '@sindresorhus/is';
import type { PackageRule } from '../../types.ts';
import { AbstractMigration } from '../base/abstract-migration.ts';

export class PackageFilesMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'packageFiles';

  override run(value: unknown): void {
    const packageRules: PackageRule[] = this.get('packageRules') ?? [];
    // v8 ignore else -- TODO: add test #40625
    if (isArray(value)) {
      const fileList: string[] = [];
      for (const packageFile of value) {
        // v8 ignore else -- TODO: add test #40625
        if (
          isNonEmptyObject(packageFile) &&
          'packageFile' in packageFile &&
          isString(packageFile.packageFile)
        ) {
          fileList.push(packageFile.packageFile);
          packageFile.paths = [packageFile.packageFile];
          delete packageFile.packageFile;

          if (Object.keys(packageFile).length > 1) {
            packageRules.push({
              ...packageFile,
            });
          }
        } else if (isArray(packageFile, isString)) {
          fileList.push(...packageFile);
        } else if (isString(packageFile)) {
          fileList.push(packageFile);
        }
      }
      if (fileList.length) {
        this.setSafely('includePaths', fileList);
      }
      if (packageRules.length) {
        this.setSafely('packageRules', packageRules);
      }
    }
  }
}
