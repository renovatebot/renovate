import parseGithubUrl from 'github-url-from-git';
import { z } from 'zod';
import { regEx } from '../../../../util/regex';
import { GithubReleasesDatasource } from '../../../datasource/github-releases';
import type { PackageDependency } from '../../types';

const githubUrlRegex = regEx(
  /^https:\/\/github\.com\/(?<packageName>[^/]+\/[^/]+)/
);

function githubPackageName(input: string): string | undefined {
  return parseGithubUrl(input)?.match(githubUrlRegex)?.groups?.packageName;
}

export const gitRules = ['git_repository'] as const;

export const GitTarget = z
  .object({
    rule: z.enum(gitRules),
    name: z.string(),
    tag: z.string().optional(),
    commit: z.string().optional(),
    remote: z.string(),
  })
  .refine(({ tag, commit }) => !!tag || !!commit)
  .transform(({ rule, name, tag, commit, remote }): PackageDependency => {
    const dep: PackageDependency = {
      depType: rule,
      depName: name,
    };

    if (tag) {
      dep.currentValue = tag;
    }

    if (commit) {
      dep.currentDigest = commit;
    }

    const githubPackage = githubPackageName(remote);
    if (githubPackage) {
      dep.datasource = GithubReleasesDatasource.id;
      dep.packageName = githubPackage;
    }

    if (!dep.datasource) {
      dep.skipReason = 'unsupported-datasource';
    }

    return dep;
  });
