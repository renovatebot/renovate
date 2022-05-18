import type { RenovateConfig } from '../../config/types';
import { logger } from '../../logger';
import type { PackageFile } from '../../modules/manager/types';

export class PackageFiles {
  private static data = new Map<string, Record<string, PackageFile[]> | null>();

  public static add(
    baseBranch: string,
    packageFiles: Record<string, PackageFile[]> | null
  ): void {
    logger.debug(
      { baseBranch },
      `PackageFiles.add() - Package file saved for branch`
    );
    this.data.set(baseBranch, packageFiles);
  }

  public static clear(): void {
    logger.debug(
      { baseBranches: [...this.data.keys()] },
      'PackageFiles.clear() - Package files deleted'
    );
    this.data.clear();
  }

  public static getDashboardMarkdown(config: RenovateConfig): string {
    const title = `## Detected dependencies\n\n`;
    const none = 'None detected\n\n';
    const pad = this.data.size > 1; // padding condition for a multi base branch repo
    let deps = '';

    for (const [branch, packageFiles] of this.data) {
      deps += pad
        ? `<details><summary>Branch ${branch}</summary>\n<blockquote>\n\n`
        : '';
      if (packageFiles === null) {
        deps += none;
        deps += pad ? '</blockquote>\n</details>\n\n' : '';
        continue;
      }

      const managers = Object.keys(packageFiles);
      if (managers.length === 0) {
        deps += none;
        deps += pad ? '</blockquote>\n</details>\n\n' : '';
        continue;
      }
      for (const manager of managers) {
        deps += `<details><summary>${manager}</summary>\n<blockquote>\n\n`;
        for (const packageFile of packageFiles[manager]) {
          deps += `<details><summary>${packageFile.packageFile}</summary>\n\n`;
          for (const dep of packageFile.deps) {
            deps += ` - \`${dep.depName} ${dep.currentValue}\`\n`;
          }
          deps += '\n</details>\n\n';
        }
        deps += `</blockquote>\n</details>\n\n`;
      }
      deps += pad ? '</blockquote>\n</details>\n\n' : '';
    }

    return title + deps;
  }
}
