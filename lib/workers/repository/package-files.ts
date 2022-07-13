import type { RenovateConfig } from '../../config/types';
import { logger } from '../../logger';
import type {
  PackageDependency,
  PackageFile,
} from '../../modules/manager/types';
import { clone } from '../../util/clone';

// import { clone } from '../../util/clone';

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

  public static pop(): PackageDependency | null {
    const [branch, managers] = Array.from(this.data).pop() ?? [];
    if (!branch) {
      return null;
    }

    if (!managers) {
      this.data.delete(branch);
      return this.pop();
    }

    const [manager, packageFiles] = Object.entries(managers).pop() ?? [];

    if (!manager) {
      return null;
    }

    if (!packageFiles) {
      delete managers[manager];
      return this.pop();
    }

    const len = packageFiles.length - 1;
    const dep = packageFiles[len].deps.pop();

    return dep ?? null;
  }

  public static getTruncatedMarkdown(
    config: RenovateConfig,
    maxLength: number
  ): [string, boolean] {
    // deep copy map
    const data = new Map(clone(Array.from(this.data)));

    let md: string;
    let dep: PackageDependency | null = null;

    do {
      md = PackageFiles.getDashboardMarkdown(config);
      if (md.length > maxLength) {
        dep = PackageFiles.pop();
      }
    } while (dep && md.length > maxLength);

    this.data = data;
    return [md, md.length !== PackageFiles.getDashboardMarkdown(config).length];
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

    return title + deps;
  }
}
