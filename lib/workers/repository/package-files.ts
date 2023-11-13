import is from '@sindresorhus/is';
import { logger } from '../../logger';
import type { PackageFile } from '../../modules/manager/types';
import { clone } from '../../util/clone';

export class PackageFiles {
  private static data = new Map<string, Record<string, PackageFile[]> | null>();

  static add(
    baseBranch: string,
    packageFiles: Record<string, PackageFile[]> | null,
  ): void {
    logger.debug(
      { baseBranch },
      `PackageFiles.add() - Package file saved for base branch`,
    );
    this.data.set(baseBranch, packageFiles);
  }

  static clear(): void {
    logger.debug('PackageFiles.clear() - Package files deleted');
    this.data.clear();
  }

  /**
   * Truncates the detected dependencies' section until it fits the available space
   * i.e. It has length smaller than maxLength.
   * This does not mutate the original PackageFiles data
   * Note:  setHeader=false is used for testing purposes only
   *        Mainly for comparing truncated and non-truncated markdown
   * @param maxLength
   * @param setHeader
   */
  static getDashboardMarkdown(maxLength: number, setHeader = true): string {
    const note =
      '> **Note**\n\n> Detected dependencies section has been truncated\n';
    const title = `## Detected dependencies\n\n`;

    // exclude header length from the available space
    const maxHeaderLen = setHeader ? (title + note).length : 0;
    const mdMaxLength = maxLength - maxHeaderLen;

    let md: string;
    let header = '';
    let removed = false;
    let truncated = false;

    const data = new Map(clone(Array.from(this.data)));

    // filter all deps with skip reason
    for (const managers of [...data.values()].filter(is.truthy)) {
      for (const files of Object.values(managers).filter(is.truthy)) {
        for (const file of files.filter((f) => is.truthy(f.deps))) {
          file.deps = file.deps.filter(is.truthy).filter((d) => !d.skipReason);
        }
      }
    }

    do {
      // shorten markdown until it fits
      md = PackageFiles.getDashboardMarkdownInternal(data);
      if (md.length > mdMaxLength) {
        // truncate data
        removed = PackageFiles.pop(data);
      }
      if (removed) {
        truncated = true; // used to set the truncation Note
      }
    } while (removed && md.length > mdMaxLength);

    header += title;
    header += truncated ? note : '';

    return (setHeader ? header : '') + md;
  }

  /**
   * Generates the "detected dependencies" markdown
   * @param data
   */
  private static getDashboardMarkdownInternal(
    data: Map<string, Record<string, PackageFile[]> | null>,
  ): string {
    const none = 'None detected\n\n';
    const pad = data.size > 1; // padding condition for a multi base branch repo
    let deps = '';

    for (const [branch, packageFiles] of data) {
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
            const ver = dep.currentValue;
            const digest = dep.currentDigest;
            const version =
              ver && digest ? `${ver}@${digest}` : `${digest ?? ver!}`;
            // TODO: types (#22198)
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

  /**
   * Removes the last dependency/entry in the PackageFiles data
   * i.e. the last line in the tobe generated detected dependency section
   * @param data
   * @Returns true if anything that translates to a markdown written line was deleted
   *          otherwise false is returned
   */
  private static pop(
    data: Map<string, Record<string, PackageFile[]> | null>,
  ): boolean {
    // get detected managers list of the last listed base branch
    const [branch, managers] = Array.from(data).pop() ?? [];
    if (!branch) {
      return false;
    }

    // delete base branch listing if it has no managers left
    if (!managers || is.emptyObject(managers)) {
      return data.delete(branch);
    }

    // get all manifest files for the last listed manager
    const [manager, packageFiles] = Object.entries(managers).pop()!;

    // delete current manager if it has no manifest files left
    if (!packageFiles || is.emptyArray(packageFiles)) {
      return delete managers[manager];
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
