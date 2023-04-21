// // import { lang, lexer, parser, query as q } from 'good-enough-parser';
// import { logger } from '../../../logger';
// import type { NestedFragment, RecordFragment } from '../bazel/types';

// class Ctx {
//   results: RecordFragment[] = [];
//   stack: NestedFragment[] = [];
//   // recordKey?: string;
//   // subRecordKey?: string;
//   // argIndex?: number;

//   constructor(readonly source: string) {}

//   // get currentFragment(): NestedFragment {
//   //   if (!this.stack) {
//   //     return
//   //   }
//   // }
// }

// // function currentFragment(ctx: Ctx): NestedFragment {
// //   const deepestFragment = ctx.stack[ctx.stack.length - 1];
// //   return deepestFragment;
// // }

// // function ruleNameHandler(ctx: Ctx, { value, offset }: lexer.Token): Ctx {
// //   const ruleFragment = currentFragment(ctx);
// //   if (ruleFragment.type === 'record') {
// //     ruleFragment.children['rule'] = { type: 'string', value, offset };
// //   }
// //   return ctx;
// // }

// const regularRule = q
//   .sym<Ctx>(supportedRulesRegex, (ctx, token) =>
//     ruleNameHandler(recordStartHandler(ctx, token), token)
//   )
//   .join(ruleCall(kwParams));

// const rule = q.alt<Ctx>(regularRule);

// const query = q.tree<Ctx>({
//   type: 'root-tree',
//   maxDepth: 16,
//   search: rule,
// });

// const starlark = lang.createLang('starlark');

// export function parse(
//   input: string,
//   packageFile?: string
// ): RecordFragment[] | null {
//   // TODO: Add the mem cache.

//   let result: RecordFragment[] | null = null;
//   try {
//     const parsedResult = starlark.query(input, query, emptyCtx(input));
//     if (parsedResult) {
//       result = parsedResult.results;
//     }
//   } catch (err) /* istanbul ignore next */ {
//     logger.debug({ err, packageFile }, 'Bazel parsing error');
//   }

//   return result;
// }

// // export class Parser {
// //   static readonly starlark = lang.createLang('starlark');
// //   constructor(readonly input: string, readonly packageFile?: string) {}
// // }
