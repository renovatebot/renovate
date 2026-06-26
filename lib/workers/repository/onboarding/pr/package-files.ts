import type { PackageFile } from '../../../../modules/manager/types.ts';

export function getPackageFilesSummary(
  packageFiles: Record<string, PackageFile[]> | null,
): string {
  if (!packageFiles || !Object.entries(packageFiles).length) {
    return '';
  }
  const sections: string[] = [];
  for (const [manager, managerFiles] of Object.entries(packageFiles)) {
    const lines = managerFiles.map((file) => ` * \`${file.packageFile}\``);
    sections.push(`#### ${manager}\n\n${lines.join('\n')}`);
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
