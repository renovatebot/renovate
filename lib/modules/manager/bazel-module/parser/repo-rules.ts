import { query as q } from 'good-enough-parser';
import { kvParams } from './common';
import type { Ctx } from './context';

// Support for use_repo_rule assignments and dynamic function calls
// Pattern: variable = use_repo_rule("load_path", "function_name")
// Followed by: variable(parameters)

// Parse use_repo_rule assignments like: pull = use_repo_rule("@rules_img//img:pull.bzl", "pull")
export const repoRuleAssignment = q
  .sym<Ctx>((ctx, token) => {
    // Track the variable name being assigned (e.g., "pull")
    return ctx.startRepoRuleAssignment(token.value);
  })
  .op('=')
  .sym('use_repo_rule')
  .join(
    q.tree({
      type: 'wrapped-tree',
      maxDepth: 1,
      search: q.many(
        q.str<Ctx>((ctx, token) => {
          // First string is load path, second is function name
          if (token.value.startsWith('@')) {
            return ctx.addRepoRuleLoadPath(token.value);
          }
          return ctx.addRepoRuleFunctionName(token.value);
        }),
      ),
      postHandler: (ctx) => ctx.endRepoRuleAssignment(),
    }),
  );

// Parse dynamic function calls like: pull(name = "ubuntu", digest = "sha256:...")
// This needs to be dynamically matched based on tracked variables
export const dynamicFunctionCall = q
  .sym<Ctx>((ctx, token) => {
    // Check if this token matches a tracked rules_img function variable
    if (ctx.isRulesImgFunction(token.value)) {
      return ctx.startDynamicFunctionCall(token.value, token.offset);
    }
    // If not a tracked function, continue without processing
    return ctx;
  })
  .join(
    q.tree({
      type: 'wrapped-tree',
      maxDepth: 1,
      search: kvParams,
      postHandler: (ctx, tree) => {
        if (tree.type === 'wrapped-tree') {
          const { endsWith } = tree;
          const endOffset = endsWith.offset + endsWith.value.length;
          return ctx.endDynamicFunctionCall(endOffset);
        }
        throw new Error(`Unexpected tree in postHandler: ${tree.type}`);
      },
    }),
  );
