import type {
  Context,
  Span,
  SpanOptions,
  Tracer,
  TracerProvider,
} from '@opentelemetry/api';
import { SpanKind } from '@opentelemetry/api';
import * as api from '@opentelemetry/api';
import { op } from 'good-enough-parser/dist/cjs/query';
import { instrument as instrumentFunc } from '../../instrumentation';
import type { SpanParameters } from '../../instrumentation/types';
import type { Decorator } from '../decorator';
import { decorate } from '../decorator';

// NOTE that I've taken a look through call sites to SimpleGit, and determined that these are the most important subcommands to measure, as well as lower priority, ungrouped subcommands
export type GitOperationType =
  /**
   * The `git clone` sub-command.
   */
  | 'clone'
  /**
   * The `git reset` sub-command.
   */
  | 'reset'
  /**
   * The `git checkout` sub-command.
   */
  | 'checkout'
  /**
   * The `git fetch` sub-command.
   */
  | 'fetch'
  /**
   * The `git push` sub-command.
   */
  | 'push'
  /**
   * The `git clean` sub-command.
   */
  | 'clean'
  /**
   * The `git merge` sub-command.
   */
  | 'merge'
  /**
   * The `git submodule` sub-command.
   */
  | 'submodule'
  /**
   * The `git commit` sub-command.
   */
  | 'commit'
  /**
   * Any "plumbing" **??** // TODO
   *
   * - `git update-index`
   *
   * See also: https://git-scm.com/book/en/v2/Git-Internals-Plumbing-and-Porcelain
   */
  | 'plumbing'
  /**
   * Any other operations  i.e.
   *
   * - `git log`
   * - `git remote`
   * - `git rev-parse`
   * - `git status`
   * - `git config`
   * - `git branch`
   *
   * See also: https://git-scm.com/book/en/v2/Git-Internals-Plumbing-and-Porcelain
   */
  | 'other';
//
// /**
//  * instruments a decorated method.
//  */
// export function instrument<T>(
//   operationType: GitOperationType,
//   {
//     name,
//     attributes,
//     ignoreParentSpan,
//     kind = SpanKind.INTERNAL,
//   }: SpanParameters): Decorator<T> {
//   return decorate(async ({ callback }) => {
//     return await instrumentFunc(name, callback, {
//       attributes,
//       root: ignoreParentSpan,
//       kind,
//     });
//   });
// }

export function instrument<F extends () => ReturnType<F>>(
  name: string,
  operationType: GitOperationType,
  fn: F,
): ReturnType<F>;
export function instrument<F extends () => ReturnType<F>>(
  name: string,
  operationType: GitOperationType,
  fn: F,
  options: SpanOptions,
): ReturnType<F>;
export function instrument<F extends () => ReturnType<F>>(
  name: string,
  operationType: GitOperationType,
  fn: F,
  options: SpanOptions = {},
  context: Context = api.context.active(),
): ReturnType<F> {
  options.attributes ??= {};

  options.attributes.foo = operationType;

  return instrumentFunc(name, fn, options);
}
