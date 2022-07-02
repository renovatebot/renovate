import is from '@sindresorhus/is';
import { migrateConfig } from '../../migration';
import type { PackageRule, RenovateConfig } from '../../types';
import { AbstractMigration } from '../base/abstract-migration';

export class PackageFilesMigration extends AbstractMigration {
  override readonly deprecated = true;
  override readonly propertyName = 'packageFiles';

  override run(value: unknown): void {
    const packageRules: PackageRule[] = this.get('packageRules') ?? [];
    if (is.array(value)) {
      const fileList = [];
      for (const packageFile of value) {
        if (is.object(packageFile) && !is.array(packageFile)) {
          fileList.push((packageFile as any).packageFile);
          if (Object.keys(packageFile).length > 1) {
            const payload = migrateConfig(
              packageFile as RenovateConfig
            ).migratedConfig;
            for (const subrule of payload.packageRules ?? []) {
              subrule.paths = [(packageFile as any).packageFile];
              packageRules.push(subrule);
            }
            delete payload.packageFile;
            delete payload.packageRules;
            if (Object.keys(payload).length) {
              packageRules.push({
                ...payload,
                paths: [(packageFile as any).packageFile],
              });
            }
          }
        } else {
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
