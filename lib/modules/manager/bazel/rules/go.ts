import { z } from 'zod';
import { regEx } from '../../../../util/regex';
import { GoDatasource } from '../../../datasource/go';
import type { PackageDependency } from '../../types';

export const goRules = ['go_repository', '_go_repository'] as const;

export const GoTarget = z
  .object({
    rule: z.enum(goRules),
    name: z.string(),
    tag: z.string().optional(),
    commit: z.string().optional(),
    importpath: z.string(),
    remote: z.string().optional(),
  })
  .refine(({ tag, commit }) => !!tag || !!commit)
  .transform(
    ({ rule, name, tag, commit, importpath, remote }): PackageDependency[] => {
      const dep: PackageDependency = {
        datasource: GoDatasource.id,
        depType: rule,
        depName: name,
        packageName: importpath,
      };

      if (tag) {
        dep.currentValue = tag;
      }

      if (commit) {
        dep.currentDigest = commit;
        if (!tag) {
          dep.digestOneAndOnly = true;
        }
      }

      if (remote) {
        const remoteMatch = regEx(
          /https:\/\/github\.com(?:.*\/)(([a-zA-Z]+)([-])?([a-zA-Z]+))/,
        ).exec(remote);
        if (remoteMatch && remoteMatch[0].length === remote.length) {
          dep.packageName = remote.replace('https://', '');
        } else {
          dep.skipReason = 'unsupported-remote';
        }
      }

      return [dep];
    },
  );
