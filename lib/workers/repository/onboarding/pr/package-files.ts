import type { PackageFile } from '../../../../modules/manager/types.ts';

const GROUP_THRESHOLD = 3;

function formatManagerFiles(files: PackageFile[]): string {
  const byDir = new Map<string, string[]>();
  for (const { packageFile } of files) {
    const lastSlash = packageFile.lastIndexOf('/');
    const dir = lastSlash >= 0 ? packageFile.slice(0, lastSlash + 1) : '';
    const name =
      lastSlash >= 0 ? packageFile.slice(lastSlash + 1) : packageFile;
    const existing = byDir.get(dir);
    if (existing) {
      existing.push(name);
    } else {
      byDir.set(dir, [name]);
    }
  }

  const lines: string[] = [];
  for (const [dir, names] of byDir) {
    if (dir && names.length >= GROUP_THRESHOLD) {
      lines.push(` * \`${dir}\``);
      for (const name of names) {
        lines.push(`   * \`${name}\``);
      }
    } else {
      for (const name of names) {
        lines.push(` * \`${dir}${name}\``);
      }
    }
  }
  return lines.join('\n');
}

export function getPackageFilesSummary(
  packageFiles: Record<string, PackageFile[]> | null,
): string {
  if (!packageFiles || !Object.entries(packageFiles).length) {
    return '';
  }
  const sections: string[] = [];
  for (const [manager, managerFiles] of Object.entries(packageFiles)) {
    sections.push(`#### ${manager}\n\n${formatManagerFiles(managerFiles)}`);
  }
  return sections.join('\n\n');
}

export function getPackageFilesDesc(
  packageFiles: Record<string, PackageFile[]> | null,
): string {
  if (!packageFiles || !Object.entries(packageFiles).length) {
    return '';
  }
  let files: string[] = [];
  for (const [manager, managerFiles] of Object.entries(packageFiles)) {
    files = files.concat(
      managerFiles.map((file) => ` * \`${file.packageFile}\` (${manager})`),
    );
  }
  return `### Detected Package Files\n\n${files.join('\n')}`;
}
