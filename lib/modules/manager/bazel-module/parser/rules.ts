import { query as q } from 'good-enough-parser';
import { regEx } from '../../../../util/regex';
import { kvParams } from './common';
import type { Ctx } from './context';

// For the purpose of parsing bazel module files in Renovate, we consider a rule
// to be any "direct function application". For example:
//
//     bazel_dep(name = "platforms", version = "0.0.11")
//     ^^^^^^^^^ --> the "rule"
//
// In bazel, rules have typically a more narrow definition. However:
// - They are syntactically indistinguishable from, say, macros.
// - In informal speech, "rule" is often used as umbrella term.

const supportedRules = [
  'archive_override',
  'bazel_dep',
  'git_override',
  'local_path_override',
  'single_version_override',
  'git_repository',
  'new_git_repository',
];
const supportedRulesRegex = regEx(`^${supportedRules.join('|')}$`);

export const rules = q
  .sym<Ctx>(supportedRulesRegex, (ctx, token) => ctx.startRule(token.value))
  .join(
    q.tree({
      type: 'wrapped-tree',
      maxDepth: 1,
      search: kvParams,
      postHandler: (ctx) => ctx.endRule(),
    }),
  );
