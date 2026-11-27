import upath from 'upath';
import { logger } from '../../../logger/index.ts';
import { readLocalFile } from '../../../util/fs/index.ts';
import { MavenDatasource } from '../../datasource/maven/index.ts';
import type {
  ExtractConfig,
  PackageFile,
  PackageFileContent,
} from '../types.ts';
import type { ParsedWrapper } from './types.ts';
import { disagreement, parseWrapper, wrapperFiles } from './utils.ts';

const depName = 'org.jetbrains.kotlin:kotlin-cli';
const wrapperNames = wrapperFiles.map((file) => file.name);

function toPackageFileContent(wrapper: ParsedWrapper): PackageFileContent {
  return {
    deps: [
      {
        depName,
        depType: 'toolchain',
        currentValue: wrapper.version,
        replaceString: wrapper.versionLine,
        datasource: MavenDatasource.id,
        registryUrls: [wrapper.downloadRoot],
      },
    ],
  };
}

export function extractPackageFile(content: string): PackageFileContent | null {
  const wrapper = parseWrapper(content);
  return wrapper ? toPackageFileContent(wrapper) : null;
}

function groupByDirectory(packageFiles: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const packageFile of packageFiles) {
    const dir = upath.dirname(packageFile);
    const group = groups.get(dir);
    if (group) {
      group.push(packageFile);
    } else {
      groups.set(dir, [packageFile]);
    }
  }
  return groups;
}

async function extractDirectory(group: string[]): Promise<PackageFile | null> {
  const wrappers: { packageFile: string; wrapper: ParsedWrapper }[] = [];
  const dir = upath.dirname(group[0]);
  // Artifact updates include both scripts, even if only one matched extraction.
  for (const name of wrapperNames) {
    const packageFile =
      group.find((file) => upath.basename(file) === name) ??
      upath.join(dir, name);

    const content = await readLocalFile(packageFile, 'utf8');
    const wrapper = content ? parseWrapper(content) : null;
    if (wrapper) {
      wrappers.push({ packageFile, wrapper });
    }
  }

  const first = wrappers.find(({ packageFile }) => group.includes(packageFile));
  if (!first) {
    return null;
  }

  for (const sibling of wrappers.filter((entry) => entry !== first)) {
    const difference = disagreement(first.wrapper, sibling.wrapper);
    if (difference) {
      logger.info(
        `Skipping Kotlin Toolchain wrapper scripts ${first.packageFile} and ${sibling.packageFile} because they declare different ${difference}`,
      );
      return null;
    }
  }

  return {
    ...toPackageFileContent(first.wrapper),
    packageFile: first.packageFile,
  };
}

export async function extractAllPackageFiles(
  _config: ExtractConfig,
  packageFiles: string[],
): Promise<PackageFile[] | null> {
  const results: PackageFile[] = [];

  for (const group of groupByDirectory(packageFiles).values()) {
    const res = await extractDirectory(group);
    if (res) {
      results.push(res);
    }
  }

  return results.length ? results : null;
}
