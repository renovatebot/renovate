import upath from 'upath';
import { logger } from '../../../logger/index.ts';
import { getSiblingFileName, readLocalFile } from '../../../util/fs/index.ts';
import { extractPackageFile as extractPyProjectFile } from '../pep621/extract.ts';
import { extractPackageFile as extractRequirementsFile } from '../pip_requirements/extract.ts';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFile,
  PackageFileContent,
} from '../types.ts';
import { parse } from './parser.ts';
import type { PantsTarget } from './types.ts';

const defaultRequirementsSource = 'requirements.txt';

function isBuildFile(packageFile: string): boolean {
  return upath.basename(packageFile).startsWith('BUILD');
}

/**
 * `python_requirements` accepts either a pip requirements file or a PEP 621
 * `pyproject.toml`, so the source's own format decides the extractor.
 */
function extractSourceFile(
  content: string,
  packageFile: string,
): Promise<PackageFileContent | null> | PackageFileContent | null {
  return upath.basename(packageFile) === 'pyproject.toml'
    ? extractPyProjectFile(content, packageFile)
    : extractRequirementsFile(content);
}

/**
 * Turns one PEP 508 requirement string into a dependency by reusing the
 * `pip_requirements` line parser, so extras, environment markers and VCS
 * requirements behave identically in both managers.
 */
function toDep(requirement: string): PackageDependency | null {
  const dep = extractRequirementsFile(requirement)?.deps?.[0];
  if (!dep?.depName) {
    return null;
  }
  return {
    ...dep,
    depType: 'python_requirement',
    // The bare version range repeats across targets in a big BUILD file; the
    // whole requirement string is what makes the replacement unambiguous.
    replaceString: requirement,
  };
}

function extractInlineDeps(targets: PantsTarget[]): PackageDependency[] {
  const deps: PackageDependency[] = [];
  for (const target of targets) {
    if (target.type !== 'python_requirement') {
      continue;
    }
    for (const { value } of target.requirements) {
      const dep = toDep(value);
      if (dep) {
        deps.push(dep);
      } else {
        logger.debug(
          { requirement: value, target: target.name },
          'pants: skipping unparseable requirement',
        );
      }
    }
  }
  return deps;
}

export async function extractPackageFile(
  content: string,
  packageFile: string,
  _config?: ExtractConfig,
): Promise<PackageFileContent | null> {
  // `python_requirements` targets point at a source file which is returned as
  // its own package file, so re-extraction lands here too.
  if (!isBuildFile(packageFile)) {
    return await extractSourceFile(content, packageFile);
  }

  const deps = extractInlineDeps(parse(content));
  return deps.length ? { deps } : null;
}

export async function extractAllPackageFiles(
  _config: ExtractConfig,
  packageFiles: string[],
): Promise<PackageFile[]> {
  const result: PackageFile[] = [];
  // A requirements file may be shared by several targets, and by several
  // BUILD files — extract it once.
  const seenRequirementsFiles = new Set<string>();

  for (const packageFile of packageFiles) {
    const content = await readLocalFile(packageFile, 'utf8');
    if (!content) {
      logger.debug({ packageFile }, 'pants: could not read file');
      continue;
    }

    const targets = parse(content);

    const deps = extractInlineDeps(targets);
    if (deps.length) {
      result.push({ packageFile, deps });
    }

    for (const target of targets) {
      if (target.type !== 'python_requirements') {
        continue;
      }
      const source = getSiblingFileName(
        packageFile,
        target.source?.value ?? defaultRequirementsSource,
      );
      if (seenRequirementsFiles.has(source)) {
        continue;
      }
      seenRequirementsFiles.add(source);

      const sourceContent = await readLocalFile(source, 'utf8');
      if (!sourceContent) {
        logger.debug(
          { packageFile, source },
          'pants: python_requirements source not found',
        );
        continue;
      }

      const extracted = await extractSourceFile(sourceContent, source);
      if (extracted?.deps?.length) {
        result.push({
          ...extracted,
          packageFile: source,
          deps: extracted.deps.map((dep) => ({
            ...dep,
            // Keep the delegate's own depType where it has one — `pep621`
            // distinguishes `project.dependencies` from optional groups, and
            // that detail is worth more in `packageRules` than uniformity.
            depType: dep.depType ?? 'python_requirements',
          })),
        });
      }
    }
  }

  return result;
}
