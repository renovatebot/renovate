import is from '@sindresorhus/is';
import type { PackageRule } from '../../types';
import { AbstractMigration } from '../base/abstract-migration';

export class PackageFilesMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'packageFiles';

  override run(value: unknown): void {
    const packageRules: PackageRule[] = this.get('packageRules') ?? [];
    if (is.array(value)) {
      const fileList: string[] = [];
      for (const packageFile of value) {
        if (
          is.nonEmptyObject(packageFile) &&
          'packageFile' in packageFile &&
          is.string(packageFile.packageFile)
        ) {
          fileList.push(packageFile.packageFile);
          packageFile.paths = [packageFile.packageFile];
          delete packageFile.packageFile;

          if (Object.keys(packageFile).length > 1) {
            packageRules.push({
              ...packageFile,
            });
          }
        } else if (is.array(packageFile, is.string)) {
          fileList.push(...packageFile);
        } else if (is.string(packageFile)) {
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
