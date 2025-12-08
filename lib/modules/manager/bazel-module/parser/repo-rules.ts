import { query as q } from 'good-enough-parser';
import type { parser } from 'good-enough-parser';
import { regEx } from '../../../../util/regex';
import { kvParams } from './common';
import type { Ctx } from './context';

// Store for tracking use_repo_rule assignments during parsing
const repoRuleVariables = new Map<
  string,
  { bzlFile: string; ruleName: string }
>();

// Parser for use_repo_rule assignments:
// pull = use_repo_rule("@rules_img//img:pull.bzl", "pull")
export const useRepoRuleAssignment = q
  .sym<Ctx>((ctx, token) => {
    // Store the variable name for later use
    (ctx as any)._tempVariableName = token.value;
    return ctx;
  })
  .op('=')
  .sym(regEx(/^use_repo_rule$/))
  .tree({
    type: 'wrapped-tree',
    maxDepth: 1,
    startsWith: '(',
    endsWith: ')',
    search: q.many(
      q.str<Ctx>((ctx, token) => {
        // Collect the string arguments
        if (!(ctx as any)._tempStrings) {
          (ctx as any)._tempStrings = [];
        }
        (ctx as any)._tempStrings.push(token.value);
        return ctx;
      }),
    ),
    postHandler: (ctx, tree) => {
      const variableName = (ctx as any)._tempVariableName;
      const strings = (ctx as any)._tempStrings;

      if (variableName && strings.length >= 2) {
        const bzlFile = strings[0];
        const ruleName = strings[1];

        // Store for later use by repoRuleCall parser
        repoRuleVariables.set(variableName, { bzlFile, ruleName });

        // Create the useRepoRule fragment
        ctx.startUseRepoRule(variableName, bzlFile, ruleName);
        ctx.endUseRepoRule();
      }

      // Clean up
      delete (ctx as any)._tempVariableName;
      delete (ctx as any)._tempStrings;

      return ctx;
    },
  });

// Parser for repository rule calls
// This parser always creates repo rule call fragments, but they will be filtered
// during extraction based on whether they correspond to known repo rule variables
export const repoRuleCall = q
  .sym<Ctx>(/^[a-zA-Z_]\w*$/, (ctx, token) => {
    return ctx.startRepoRuleCall(token.value, token.offset);
  })
  .join(
    q.tree({
      type: 'wrapped-tree',
      maxDepth: 1,
      search: kvParams,
      postHandler: (ctx, tree) => {
        const { endsWith } = tree as parser.WrappedTree;
        const endOffset = endsWith.offset + endsWith.value.length;
        return ctx.endRepoRuleCall(endOffset);
      },
    }),
  );

export function clearRepoRuleVariables(): void {
  repoRuleVariables.clear();
}
