import is from '@sindresorhus/is';
import type { RenovateConfig } from '../../config/types';
import { logger } from '../../logger';
import type { PackageFile } from '../../modules/manager/types';
import { clone } from '../../util/clone';

export class PackageFiles {
  private static data = new Map<string, Record<string, PackageFile[]> | null>();

  static add(
    baseBranch: string,
    packageFiles: Record<string, PackageFile[]> | null
  ): void {
    logger.debug(
      { baseBranch },
      `PackageFiles.add() - Package file saved for branch`
    );
    this.data.set(baseBranch, clone(packageFiles));
  }

  static clear(): void {
    logger.debug(
      { baseBranches: [...this.data.keys()] },
      'PackageFiles.clear() - Package files deleted'
    );
    this.data.clear();
  }

  /**
   * Truncates the detected dependencies' section until it fits the available space
   * i.e. It has length smaller than maxLength.
   * This does not mutate the original PackageFiles data
   * Note:  setHeader=false is used for testing purposes only
   *        Mainly for comparing truncated and non-truncated markdown
   * @param config
   * @param maxLength
   * @param setHeader
   */
  static getDashboardMarkdown(
    config: RenovateConfig,
    maxLength: number,
    setHeader = true
  ): string {
    const note =
      '> **Note**\n> Detected dependencies section has been truncated\n';
    const title = `## Detected dependencies\n\n`;

    // exclude header length from the available space
    const maxHeaderLen = setHeader ? (title + note).length : 0;
    const mdMaxLength = maxLength - maxHeaderLen;

    let md: string;
    let header = '';
    let removed = false;
    let truncated = false;
    let restore: (() => void) | null = null;

    do {
      // shorten markdown until it fits
      md = PackageFiles.getDashboardMarkdownInternal(config);
      if (md.length > mdMaxLength) {
        // backup data
        if (!restore) {
          restore = this.backup();
        }
        // truncate data
        removed = PackageFiles.pop();
      }
      if (removed) {
        truncated = true; // used to set the truncation Note
      }
    } while (removed && md.length > mdMaxLength);

    if (restore) {
      restore();
    } // restore original PackageFiles data

    header += title;
    header += truncated ? note : '';

    return (setHeader ? header : '') + md;
  }

  /**
   * Generates the "detected dependencies" markdown
   * @param config
   */
  private static getDashboardMarkdownInternal(config: RenovateConfig): string {
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
          // TODO: types (#7154)
          deps += `<details><summary>${packageFile.packageFile!}</summary>\n\n`;
          for (const dep of packageFile.deps) {
            const ver = dep.currentValue;
            const digest = dep.currentDigest;
            const version =
              ver && digest
                ? `${ver}@${digest}`
                : `${digest ?? ver ?? placeHolder}`;
            // TODO: types (#7154)
            deps += ` - \`${dep.depName!} ${version}\`\n`;
          }
          deps += '\n</details>\n\n';
        }
        deps += `</blockquote>\n</details>\n\n`;
      }
      deps += pad ? '</blockquote>\n</details>\n\n' : '';
    }

    return deps;
  }

  private static backup(): () => void {
    const backup = this.data; // backup data
    // deep clone data
    this.data = new Map(clone(Array.from(this.data))); // only mutate cloned data

    return () => {
      this.data = backup;
    };
  }

  /**
   * Removes the last dependency/entry in the PackageFiles data
   * i.e. the last line in the tobe generated detected dependency section
   * @Returns true if anything that translates to a markdown written line was deleted
   *          otherwise false is returned
   */
  private static pop(): boolean {
    // get detected managers list of the last listed base branch
    const [branch, managers] = Array.from(this.data).pop() ?? [];
    if (!branch) {
      return false;
    }

    // delete base branch listing if it has no managers left
    if (!managers || is.emptyObject(managers)) {
      return this.data.delete(branch);
    }

    // get all manifest files for the last listed manager
    const [manager, packageFiles] = Object.entries(managers).pop() ?? [];

    // delete current manager if it has no manifest files left
    if (!packageFiles || is.emptyArray(packageFiles)) {
      return delete managers[manager!];
    }

    // delete manifest file if it has no deps left
    const len = packageFiles.length - 1;
    if (is.emptyArray(packageFiles[len].deps)) {
      return !!packageFiles.pop();
    }

    // remove the last listed dependency
    return !!packageFiles[len].deps.pop();
  }
}
