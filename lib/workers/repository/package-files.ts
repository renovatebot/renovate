import is from '@sindresorhus/is';
import type { RenovateConfig } from '../../config/types';
import { logger } from '../../logger';
import type { PackageFile } from '../../modules/manager/types';
import { clone } from '../../util/clone';

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

  static pop(): boolean {
    const [branch, managers] = Array.from(this.data).pop() ?? [];
    if (!branch) {
      return false;
    }

    if (!managers || is.emptyObject(managers)) {
      return this.data.delete(branch);
    }

    const [manager, packageFiles] = Object.entries(managers).pop() ?? [];

    if (!packageFiles || is.emptyArray(packageFiles)) {
      return delete managers[manager!];
    }

    const len = packageFiles.length - 1;
    if (is.emptyArray(packageFiles[len].deps)) {
      return !!packageFiles.pop();
    }

    return !!packageFiles[len].deps.pop();
  }

  public static getTruncatedMarkdown(
    config: RenovateConfig,
    maxLength: number,
    setHeader = true
  ): string {
    const org = this.data; // backup data
    // deep clone data
    this.data = new Map(clone(Array.from(this.data))); // only mutate cloned data

    const note =
      '> **Note**\n> Detected dependencies section has been truncated\n';
    const title = `## Detected dependencies\n\n`;
    const mdMaxLength = maxLength - (setHeader ? (title + note).length : 0);

    let md: string;
    let header = '';
    let removed = false;
    let truncated = false;

    do {
      md = PackageFiles.getDashboardMarkdown(config, false);
      if (md.length > mdMaxLength) {
        removed = PackageFiles.pop();
      }
      if (removed) {
        truncated = true;
      }
    } while (removed && md.length > mdMaxLength);

    this.data = org; // restore data

    header += title;
    header += truncated ? note : '';

    return (setHeader ? header : '') + md;
  }

  public static getDashboardMarkdown(
    config: RenovateConfig,
    setTitle = true
  ): string {
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

      const placeHolder = `no version found`;

      for (const manager of managers) {
        deps += `<details><summary>${manager}</summary>\n<blockquote>\n\n`;
        for (const packageFile of packageFiles[manager]) {
          deps += `<details><summary>${packageFile.packageFile}</summary>\n\n`;
          for (const dep of packageFile.deps) {
            const ver = dep.currentValue;
            const digest = dep.currentDigest;
            const version =
              ver && digest
                ? `${ver}@${digest}`
                : `${digest ?? ver ?? placeHolder}`;
            deps += ` - \`${dep.depName} ${version}\`\n`;
          }
          deps += '\n</details>\n\n';
        }
        deps += `</blockquote>\n</details>\n\n`;
      }
      deps += pad ? '</blockquote>\n</details>\n\n' : '';
    }

    return (setTitle ? title : '') + deps;
  }
}
