import { z } from 'zod/v4';
import { coerceArray } from '../../../util/array.ts';
import { getHttpUrl, parseGitUrl } from '../../../util/git/url.ts';
import { regEx } from '../../../util/regex.ts';
import { isLongCommitSha } from '../../../util/schema-utils/git.ts';
import { LooseArray, Nullish, Yaml } from '../../../util/schema-utils/index.ts';
import type { PackageDependency } from '../types.ts';
import { applyGitSource } from '../util.ts';

const urlRegex = regEx(/^[a-z][a-z0-9+.-]*:\/\//i);
const hackageExtraDepRegex = regEx(
  /^(?<name>[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*?)-(?<version>\d+(?:\.\d+)*)(?:@\S+)?$/,
);

function toStringDep(entry: string): PackageDependency {
  if (urlRegex.test(entry)) {
    return { depName: entry, skipReason: 'unsupported-url' };
  }
  const match = hackageExtraDepRegex.exec(entry);
  if (!match?.groups) {
    return { depName: entry, skipReason: 'local-dependency' };
  }
  return {
    depName: match.groups.name,
    currentValue: match.groups.version,
    skipReason: 'unsupported',
  };
}

function getGitNames(
  url: string,
): Pick<PackageDependency, 'depName' | 'sourceUrl'> {
  try {
    return {
      depName: parseGitUrl(url).full_name,
      sourceUrl: getHttpUrl(url).replace(regEx(/\.git$/), ''),
    };
  } catch {
    return { depName: url };
  }
}

function toCommitDep(
  url: string,
  sha: string,
  commit: string,
): PackageDependency {
  const dep: PackageDependency = {
    ...getGitNames(url),
    autoReplaceStringTemplate: '{{{newDigest}}}',
  };
  applyGitSource(dep, url, sha, undefined, undefined);
  dep.replaceString = commit;
  return dep;
}

function toGitDep(url: string, commit: string): PackageDependency {
  const sha = commit.toLowerCase();
  const dep = toCommitDep(url, sha, commit);
  if (!isLongCommitSha(sha)) {
    dep.skipReason = 'unversioned-reference';
  }
  return dep;
}

const StringExtraDep = z.string().transform(toStringDep);

const GitExtraDep = z
  .object({ git: z.string(), commit: z.string() })
  .transform(({ git, commit }) => toGitDep(git, commit));

const GithubExtraDep = z
  .object({ github: z.string(), commit: z.string() })
  .transform(({ github, commit }) =>
    toGitDep(`https://github.com/${github}`, commit),
  );

const HgExtraDep = z
  .object({ hg: z.string() })
  .transform(({ hg }): PackageDependency => ({
    depName: hg,
    skipReason: 'unsupported-remote',
  }));

const ArchiveExtraDep = z
  .object({ url: z.string() })
  .transform(({ url }): PackageDependency => ({
    depName: url,
    skipReason: 'unsupported-url',
  }));

// Stack parses stack.yaml with the Haskell `yaml` package, which mostly follows
// YAML 1.1, while this parser follows YAML 1.2.
export const StackYaml = Yaml.pipe(
  z.object({
    'extra-deps': Nullish(
      LooseArray(
        z.union([
          StringExtraDep,
          GitExtraDep,
          GithubExtraDep,
          HgExtraDep,
          ArchiveExtraDep,
        ]),
      ),
    ),
  }),
).transform(({ 'extra-deps': extraDeps }) => coerceArray(extraDeps));
