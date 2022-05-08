import type { RenovateConfig } from '../../config/types';
import type { PackageFile } from '../../modules/manager/types';

export class PackageFiles {
  private static data: Map<string, Record<string, PackageFile[]> | null> =
    new Map<string, Record<string, PackageFile[]>>();

  public static add(
    baseBranch: string,
    packageFiles: Record<string, PackageFile[]> | null
  ): void {
    this.data.set(baseBranch, packageFiles);
  }

  public static clear(): void {
    this.data.clear();
  }

  public static getDashboardMarkdown(config: RenovateConfig): string {
    const title = `## Detected dependencies\n\n`;
    const none = 'None detected\n\n';
    const pad = this.data.size > 1; // padding condition for a multi base branch repo
    let deps = '';

    if (!config.dependencyDashboardDetectedDeps) {
      return '';
    }

    for (const [branch, packageFiles] of this.data) {
      deps += pad ? `<details><summary>Branch ${branch}\n</summary>\n\n` : '';
      if (packageFiles === null) {
        deps += none + '\n';
        continue;
      }

      const managers = Object.keys(packageFiles);
      if (managers.length === 0) {
        deps += none + '\n';
        continue;
      }

      for (const manager of managers) {
        deps += `${
          pad ? '<ul>' : ''
        }<details><summary>${manager}</summary>\n\n`;
        for (const packageFile of packageFiles[manager]) {
          deps += `<ul><details><summary>${packageFile.packageFile}</summary>\n\n`;
          for (const dep of packageFile.deps) {
            deps += ` - \`${dep.depName} ${dep.currentValue}\`\n`;
          }
          deps += '</details></ul>';
        }
        deps += `</details>${pad ? '</ul>' : ''}`;
      }
      deps += pad ? '</details>\n\n' : '';
    }

    return title + deps;
  }
}
