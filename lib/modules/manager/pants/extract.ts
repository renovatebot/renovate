import upath from 'upath';
import { logger } from '../../../logger/index.ts';
import { getSiblingFileName, readLocalFile } from '../../../util/fs/index.ts';
import { extractPackageFile as extractPyProjectFile } from '../pep621/extract.ts';
import { extractPackageFile as extractRequirementsFile } from '../pip_requirements/extract.ts';
import { extractPackageFile as extractPoetryFile } from '../poetry/extract.ts';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFile,
  PackageFileContent,
} from '../types.ts';
import { parse } from './parser.ts';
import type { PantsTarget, PantsTargetType } from './types.ts';

const defaultSources: Record<PantsTargetType, string> = {
  python_requirement: '',
  python_requirements: 'requirements.txt',
  poetry_requirements: 'pyproject.toml',
  uv_requirements: 'pyproject.toml',
};

function isBuildFile(packageFile: string): boolean {
  return upath.basename(packageFile).startsWith('BUILD');
}

/**
 * Poetry declares itself with a `[tool.poetry]` table, or with a table below
 * it such as `[tool.poetry.dependencies]`. Matching the `[tool.poetry` prefix
 * alone would also match an unrelated tool whose name merely starts the same
 * way, such as `[tool.poetry-dynamic-versioning]`, and would then route a
 * PEP 621 file to the Poetry extractor, which reads none of its `[project]`
 * dependencies.
 */
function isPoetryPyProject(content: string): boolean {
  return content.includes('[tool.poetry]') || content.includes('[tool.poetry.');
}

/**
 * A generator's `source` can be a pip requirements file, or a `pyproject.toml`
 * in PEP 621, Poetry or uv form, so the file's own content decides the
 * extractor. Deciding on content rather than on which target pointed at the
 * file keeps extraction and re-extraction, which only knows the filename,
 * from ever disagreeing.
 */
function extractSourceFile(
  content: string,
  packageFile: string,
): Promise<PackageFileContent | null> | PackageFileContent | null {
  if (upath.basename(packageFile) !== 'pyproject.toml') {
    return extractRequirementsFile(content);
  }
  return isPoetryPyProject(content)
    ? extractPoetryFile(content, packageFile)
    : extractPyProjectFile(content, packageFile);
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
  // A generator target points at a source file which is returned as its own
  // package file, so re-extraction lands here too.
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
  // A source file may be shared by several targets, and by several build
  // files, so extract it once.
  const seenSourceFiles = new Set<string>();

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
      if (target.type === 'python_requirement') {
        continue;
      }
      const source = getSiblingFileName(
        packageFile,
        target.source?.value ?? defaultSources[target.type],
      );
      if (seenSourceFiles.has(source)) {
        continue;
      }
      seenSourceFiles.add(source);

      const sourceContent = await readLocalFile(source, 'utf8');
      if (!sourceContent) {
        logger.debug(
          { packageFile, source, target: target.type },
          'pants: generator source not found',
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
            // Keep the depType of the delegate where it has one. `pep621`
            // and `poetry` distinguish dependency groups, and that detail is
            // worth more in `packageRules` than uniformity.
            depType: dep.depType ?? target.type,
          })),
        });
      }
    }
  }

  return result;
}
