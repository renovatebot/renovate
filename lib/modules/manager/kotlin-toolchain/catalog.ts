import { logger } from '../../../logger/index.ts';
import { parseCatalog } from '../../../util/gradle-version-catalog/index.ts';
import { regEx } from '../../../util/regex.ts';
import { MavenDatasource } from '../../datasource/maven/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import type { KotlinToolchainManagerData } from './types.ts';

export function normalizeCatalogAlias(alias: string): string {
  return alias.replace(regEx(/[-_]/g), '.');
}

export function extractCatalog(
  content: string,
  packageFile: string,
): PackageFileContent<KotlinToolchainManagerData> | null {
  try {
    const deps: PackageDependency<KotlinToolchainManagerData>[] = parseCatalog(
      packageFile,
      content,
      {
        includePlugins: false,
        allowRichVersions: false,
        includeLibraryAliases: true,
      },
    ).deps;

    for (const dep of deps) {
      dep.datasource = MavenDatasource.id;
      dep.depType = 'versionCatalog';

      if (!dep.currentValue) {
        continue;
      }
      const position = dep.managerData!.fileReplacePosition!;
      const valueEnd = position + dep.currentValue.length;
      if (content.slice(position, valueEnd) !== dep.currentValue) {
        dep.skipReason = 'invalid-value';
        continue;
      }

      const lineStart = content.lastIndexOf('\n', position) + 1;
      const nextLine = content.indexOf('\n', valueEnd);
      const lineEnd = nextLine === -1 ? content.length : nextLine;
      dep.replaceString = content.slice(lineStart, lineEnd);
      // Preserve equal version literals in coordinates and comments.
      dep.autoReplaceStringTemplate =
        '{{{managerData.replacePrefix}}}{{{newValue}}}{{{managerData.replaceSuffix}}}';
      dep.managerData = {
        ...dep.managerData,
        replacePrefix: content.slice(lineStart, position),
        replaceSuffix: content.slice(valueEnd, lineEnd),
      } satisfies KotlinToolchainManagerData;
    }

    return { deps };
  } catch (err) {
    logger.debug(
      { err, packageFile },
      'Failed to parse Kotlin Toolchain catalog',
    );
    return null;
  }
}
