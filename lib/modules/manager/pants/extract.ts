import upath from 'upath';
import { z } from 'zod/v4';
import { logger } from '../../../logger/index.ts';
import { getSiblingFileName, readLocalFile } from '../../../util/fs/index.ts';
import { regEx } from '../../../util/regex.ts';
import { Result } from '../../../util/result.ts';
import { matchRegexOrGlobList } from '../../../util/string-match.ts';
import {
  massage as massageToml,
  parse as parseToml,
} from '../../../util/toml.ts';
import { extractPackageFile as extractPyProjectFile } from '../pep621/extract.ts';
import { extractPackageFile as extractRequirementsFile } from '../pip_requirements/extract.ts';
import { defaultConfig as pipRequirementsConfig } from '../pip_requirements/index.ts';
import { extractPackageFile as extractPoetryFile } from '../poetry/extract.ts';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFile,
  PackageFileContent,
} from '../types.ts';
import { parse } from './parser.ts';
import type {
  PantsGeneratorType,
  PantsRequirement,
  PantsTarget,
} from './types.ts';

const defaultSources: Record<PantsGeneratorType, string> = {
  python_requirements: 'requirements.txt',
  poetry_requirements: 'pyproject.toml',
  uv_requirements: 'pyproject.toml',
};

// The names Pants' default `build_patterns` cover, and no more: a source called
// `BUILD_requirements.txt` is a source.
const buildFileName = regEx(/^BUILD(\.[^/]+)?$/);

// A file named like a document is far more likely to be one, and reading it to
// find out is what proposes changes to documentation: the fenced examples in a
// `BUILD.md` parse as targets, and claim whatever file they name as a source.
//
// Document formats only, and it must stay that way -- `.txt` and `.in` belong to
// real generator sources, so adding one would take every `requirements.txt` in
// the repository out of play.
const proseExtensions = new Set([
  '.md',
  '.markdown',
  '.mdx',
  '.rst',
  '.adoc',
  '.asciidoc',
  '.org',
  '.textile',
]);

function extension(packageFile: string): string {
  // Lower-cased so that `pyproject.TOML` does not fall past every extension
  // check and reach the requirements parser, which finds nothing in it.
  return upath.extname(packageFile).toLowerCase();
}

function isProse(packageFile: string): boolean {
  return proseExtensions.has(extension(packageFile));
}

// Extensions only a generator source carries, read as a source without
// consulting the content, so that a stray line parsing as a target cannot change
// the answer. `.txt` is the default source of `python_requirements`; `.pip` and
// `.in` are other spellings of the same format.
//
// `.toml` is deliberately absent, because valid TOML cannot parse as a target --
// it has no statement-level call syntax -- so it can be left to the content
// check. A requirements file has no grammar at all, so a bare call is possible
// there. The cost is that a requirements-format file named `*.toml` holding a
// target call is read as a build file, and only the recorded reading gets it
// right.
const sourceOnlyExtensions = new Set(['.txt', '.pip', '.in']);

/**
 * How a file was read, recorded on every dependency taken from it.
 *
 * `extractPackageFile` is also the auto-replace confirmation, where it must
 * reach the same answer extraction did or the update fails. The config cannot
 * say: `managerFilePatterns` is a repository-stage option, stripped by
 * `filterConfig(update, 'branch')`. `managerData` is not a config option, so it
 * survives and the confirmation can be told rather than left to guess.
 */
type ReadAs = 'buildFile' | 'source';

function readAs(dep: PackageDependency, value: ReadAs): PackageDependency {
  // Spread rather than replace: delegates put their own fields here, such as
  // Poetry's `nestedVersion`.
  return { ...dep, managerData: { ...dep.managerData, pantsReadAs: value } };
}

/**
 * How extraction read this file, but only when the config is about this file. A
 * branch config is built as `{ ...config, ...config.upgrades[0] }`, so a branch
 * spanning a build file and a source carries one reading for both, and one of
 * the two would be read the wrong way.
 */
function recordedReading(
  packageFile: string,
  config?: ExtractConfig,
): ReadAs | undefined {
  if (config?.packageFile !== packageFile) {
    return undefined;
  }
  const recorded = config?.managerData?.pantsReadAs;
  return recorded === 'buildFile' || recorded === 'source'
    ? recorded
    : undefined;
}

const PoetryPyProject = z.object({
  tool: z.object({ poetry: z.record(z.string(), z.unknown()) }),
});

type SourceFormat = 'poetry' | 'pep621' | 'requirements';

/**
 * Poetry announces itself with a `tool.poetry` table. Parsing the file rather
 * than searching for a table header gets the legal spellings right:
 * `[ tool.poetry ]`, `[tool."poetry"]`, an inline `poetry = {}` under `[tool]`,
 * a dotted `tool.poetry.dependencies` key, an unrelated
 * `[tool.poetry-dynamic-versioning]`, and one that appears only inside a string.
 */
function tomlSourceFormat(content: string, packageFile: string): SourceFormat {
  const { val: result, err } = Result.wrap(() =>
    PoetryPyProject.safeParse(parseToml(massageToml(content))),
  ).unwrap();

  if (err) {
    // Pants reads any source other than a `pyproject.toml` with its
    // requirements parser, so do that rather than reporting nothing.
    logger.debug({ err, packageFile }, 'pants: TOML source does not parse');
    return 'requirements';
  }

  return result.success ? 'poetry' : 'pep621';
}

/**
 * A generator's `source` can be a pip requirements file, or a TOML file in
 * PEP 621, Poetry or uv form, and Pants does not require either to be named a
 * particular way: a `poetry_requirements` target reads whatever file it is
 * given as Poetry.
 *
 * So any TOML file is routed by its content, and everything else read as a pip
 * requirements file. Deciding on content rather than on the target that pointed
 * here keeps extraction and re-extraction, which knows only the filename, from
 * disagreeing.
 */
function sourceFormat(content: string, packageFile: string): SourceFormat {
  if (extension(packageFile) !== '.toml') {
    return 'requirements';
  }
  return tomlSourceFormat(content, packageFile);
}

function extractSourceFile(
  content: string,
  packageFile: string,
  format: SourceFormat,
): Promise<PackageFileContent | null> | PackageFileContent | null {
  switch (format) {
    case 'poetry':
      return extractPoetryFile(content, packageFile);
    case 'pep621':
      return extractPyProjectFile(content, packageFile);
    default:
      return extractRequirementsFile(content);
  }
}

/**
 * A requirements file with `--hash=` entries needs its hashes refreshed whenever
 * a pin changes, which `pip_requirements` does and this manager cannot. Claiming
 * such a file would bump the pin and leave every install failing on a hash
 * mismatch.
 *
 * Keyed on the format rather than the name, so a file routed to the requirements
 * parser is covered however it is called.
 */
function hasRequirementHashes(content: string, format: SourceFormat): boolean {
  return format === 'requirements' && content.includes('--hash=');
}

/**
 * Reuses the `pip_requirements` line parser, so extras, environment markers and
 * VCS requirements behave identically in both managers.
 */
function toDep(requirement: PantsRequirement): PackageDependency | null {
  const dep = extractRequirementsFile(requirement.value)?.deps?.[0];
  if (!dep?.depName) {
    return null;
  }

  if (requirement.parts.length === 1) {
    // Anchors the replacement on the requirement text rather than a bare version
    // range, which in a build file can also appear in a comment or an unrelated
    // field. Renovate walks later occurrences itself when several targets pin
    // the same requirement.
    return {
      ...dep,
      depType: 'python_requirement',
      replaceString: requirement.value,
    };
  }

  const { currentValue } = dep;
  if (currentValue && requirement.parts.some((p) => p.includes(currentValue))) {
    // Adjacent literals, so the joined text sits in no single place and cannot
    // anchor the replacement. The version does sit whole inside one literal, and
    // Renovate falls back to replacing it there.
    return { ...dep, depType: 'python_requirement' };
  }

  // Neither the requirement nor its version is written in one piece, as when a
  // specifier is split across two literals, so nothing can be replaced. Judged
  // from this requirement alone: the same text elsewhere belongs to another
  // target.
  return {
    ...dep,
    depType: 'python_requirement',
    skipReason: 'unsupported',
  };
}

function extractInlineDeps(targets: PantsTarget[]): PackageDependency[] {
  const deps: PackageDependency[] = [];
  for (const target of targets) {
    if (target.type !== 'python_requirement') {
      continue;
    }
    if (!target.requirements.length) {
      // Pants requires this field, so its value is not a list of literal
      // strings: a variable, or something computed from one.
      logger.debug(
        { target: target.name },
        'pants: no literal requirements in a python_requirement target',
      );
      continue;
    }
    for (const requirement of target.requirements) {
      const dep = toDep(requirement);
      if (dep) {
        deps.push(readAs(dep, 'buildFile'));
      } else {
        logger.debug(
          { requirement: requirement.value, target: target.name },
          'pants: skipping unparseable requirement',
        );
      }
    }
  }
  return deps;
}

/**
 * Reads a generator source, and marks its dependencies as skipped when nothing
 * here can update them: a lock file beside the source, or hashes that only
 * `pip_requirements` can refresh. The entry then declares `cannotUpdate`, so it
 * reports what is in the file without taking it from the manager that owns the
 * format.
 *
 * Both entry points read a source through this, so a file both agree is a source
 * cannot be extracted one way and confirmed another.
 *
 * `cannotUpdate` depends on an invariant worth stating: every other skip reason
 * here is the delegate's own, inherited from its extractor -- Poetry marking a
 * path override `path-dependency`, say -- and taking such a file from the
 * delegate loses nothing. Only the lock and hash cases are this manager's own
 * judgement, and they are exactly the two that set `cannotUpdate`. A
 * pants-specific skip added without setting it would start taking files from the
 * manager that could maintain them.
 *
 * Returns null for a hashed source that `pip_requirements` claims by name.
 */
async function readSource(
  content: string,
  packageFile: string,
): Promise<PackageFileContent | null> {
  const format = sourceFormat(content, packageFile);

  let hashed = false;
  if (hasRequirementHashes(content, format)) {
    // The other manager's *default* patterns, not the user's resolved config.
    // Where a user has widened `pip_requirements` to cover this name, both
    // managers report the file and `cannotUpdate` below stops this one taking
    // it. Reading the effective config here would return null in that same
    // case, leaving nobody holding the file.
    if (
      matchRegexOrGlobList(
        packageFile,
        pipRequirementsConfig.managerFilePatterns,
      )
    ) {
      return null;
    }
    hashed = true;
  }

  const extracted = await extractSourceFile(content, packageFile, format);
  if (!extracted) {
    return extracted;
  }

  const locked = !!extracted.lockFiles?.length;
  // Never forwarded, not even empty: an empty list still reads as a claim this
  // manager cannot honour. Stripped before the early return too, so no path out
  // of here can carry one.
  const { lockFiles: _lockFiles, ...withoutLockFiles } = extracted;
  if (!extracted.deps?.length) {
    return withoutLockFiles;
  }

  return {
    ...withoutLockFiles,
    // Every dependency below is skipped, so this entry exists to be seen rather
    // than acted on, and says so explicitly to keep Renovate from taking the
    // file from the manager that owns its format.
    //
    // The `locked` half only looks redundant. Renovate drops this entry when the
    // other manager reports a lock file for the same path, but only when that
    // manager matched the file by name: the same file under a name a `source=`
    // gave it is matched by nothing, and then the flag is what stops this entry
    // claiming it.
    ...(locked || hashed ? { cannotUpdate: true } : {}),
    deps: extracted.deps.map((dep) =>
      readAs(
        (locked || hashed) && !dep.skipReason
          ? { ...dep, skipReason: 'unsupported' as const }
          : dep,
        'source',
      ),
    ),
  };
}

function extractBuildFile(content: string): PackageFileContent | null {
  const deps = extractInlineDeps(parse(content));
  return deps.length ? { deps } : null;
}

export async function extractPackageFile(
  content: string,
  packageFile: string,
  config?: ExtractConfig,
): Promise<PackageFileContent | null> {
  // This function is also the auto-replace confirmation, and answering
  // differently here than extraction did fails every update to the file. So the
  // order is fixed, and everything answerable without opening the file is asked
  // before the content.
  //
  // Prose is first and not overridable: such a file cannot be told from a build
  // file without reading it, and reading it is what proposes changes to
  // documentation.
  if (isProse(packageFile)) {
    return null;
  }

  const recorded = recordedReading(packageFile, config);
  if (recorded) {
    return recorded === 'buildFile'
      ? extractBuildFile(content)
      : await readSource(content, packageFile);
  }

  if (buildFileName.test(upath.basename(packageFile))) {
    return extractBuildFile(content);
  }

  if (sourceOnlyExtensions.has(extension(packageFile))) {
    return await readSource(content, packageFile);
  }

  // The content settles every remaining name: a build file named its own way, a
  // `.toml` that could be either, and anything unfamiliar. Reached without a
  // record when a warm extract cache replays dependencies extracted before the
  // reading was recorded, since the cache fingerprint covers this manager's
  // tests and not its implementation.
  //
  // The trade cuts both ways there: a build file under a source-only extension
  // is read as a source, and a requirements file called `*.toml` as a build
  // file. Both need a name nobody writes by accident.
  if (parse(content).length) {
    return extractBuildFile(content);
  }

  return await readSource(content, packageFile);
}

export async function extractAllPackageFiles(
  config: ExtractConfig,
  packageFiles: string[],
): Promise<PackageFile[]> {
  const result: PackageFile[] = [];
  // A source file may be shared by several targets, and by several build
  // files, so extract it once.
  const seenSourceFiles = new Set<string>();

  for (const packageFile of packageFiles) {
    if (isProse(packageFile)) {
      logger.debug(
        { packageFile },
        'pants: prose rather than a build file, skipping',
      );
      continue;
    }

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
      if (target.sourceUnresolved && !target.source) {
        // The default would name a different file, which this manager would then
        // claim from the manager owning its format.
        logger.debug(
          { packageFile, target: target.name },
          'pants: source is not a literal, skipping the target',
        );
        continue;
      }

      const source = getSiblingFileName(
        packageFile,
        target.source ?? defaultSources[target.type],
      );
      if (seenSourceFiles.has(source)) {
        continue;
      }
      seenSourceFiles.add(source);

      if (isProse(source)) {
        logger.debug(
          { packageFile, source },
          'pants: a target names prose as its source, skipping',
        );
        continue;
      }

      if (buildFileName.test(upath.basename(source))) {
        // Pants would read this file as a build file rather than the source the
        // target claims it is, which is a contradiction in the repository
        // rather than something to resolve by picking a side.
        //
        // A source only a *configured* pattern covers is not refused: there the
        // target is the authority on what the file is for.
        logger.warn(
          { packageFile, source },
          'pants: a target names a build file as its source',
        );
        continue;
      }

      let sourceContent: string | null = null;
      try {
        sourceContent = await readLocalFile(source, 'utf8');
      } catch (err) {
        // A `source` can resolve outside the repository, and reading such a path
        // throws. Uncaught, that fails extraction for every manager.
        logger.warn(
          { err, packageFile, source },
          'pants: cannot read the source a target names',
        );
        continue;
      }

      if (!sourceContent) {
        logger.debug(
          { packageFile, source, target: target.type },
          'pants: generator source not found',
        );
        continue;
      }

      const extracted = await readSource(sourceContent, source);
      if (extracted?.deps?.length) {
        if (extracted.deps.some((dep) => dep.skipReason)) {
          logger.debug(
            { packageFile, source },
            'pants: nothing here can update this source, reporting it as skipped',
          );
        }
        result.push({
          ...extracted,
          packageFile: source,
          deps: extracted.deps.map((dep) => ({
            ...dep,
            // `pep621` and `poetry` distinguish dependency groups, which is
            // worth more in `packageRules` than a uniform depType.
            depType: dep.depType ?? target.type,
          })),
        });
      }
    }
  }

  return result;
}
