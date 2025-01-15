import { query as q } from 'good-enough-parser';
import { regEx } from '../../../../util/regex';
import type { Ctx } from '../context';
import { kvParams } from './common';

const supportedRules = [
  'archive_override',
  'bazel_dep',
  'git_override',
  'local_path_override',
  'single_version_override',
  'git_repository',
];
const supportedRulesRegex = regEx(`^${supportedRules.join('|')}$`);

export const moduleRules = q
  .sym<Ctx>(supportedRulesRegex, (ctx, token) => ctx.startRule(token.value))
  .join(
    q.tree({
      type: 'wrapped-tree',
      maxDepth: 1,
      search: kvParams,
      postHandler: (ctx) => ctx.endRule(),
    }),
  );
