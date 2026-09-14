import type { RenovateConfig } from '../../../config/types.ts';
import { logger } from '../../../logger/index.ts';
import { filterValidCommitTrailers } from '../../../util/git/commit-trailers.ts';
import { compile } from '../../../util/template/index.ts';

export type CommitBodyConfig = Pick<
  RenovateConfig,
  'commitBody' | 'commitTrailers'
>;

export interface CompiledCommitMessage {
  /** The subject, plus the compiled `commitBody` when one is configured */
  message: string;
  /** The compiled `commitTrailers`, or `undefined` when none are configured */
  trailers: string[] | undefined;
}

/**
 * Appends the compiled `commitBody` to `message` and compiles `commitTrailers`.
 *
 * `bodyContext` is the template context for `commitBody`, `trailersContext` the one for `commitTrailers`. They are separate because the branch worker exposes the changelog of the first upgrade to the body only.
 */
export function compileCommitBodyAndTrailers(
  config: CommitBodyConfig,
  message: string,
  bodyContext: object,
  trailersContext: object = bodyContext,
): CompiledCommitMessage {
  let compiledMessage = message;
  if (config.commitBody) {
    compiledMessage = `${message}\n\n${compile(config.commitBody, bodyContext)}`;
    logger.trace(`commitMessage: ${JSON.stringify(compiledMessage)}`);
  }

  let trailers: string[] | undefined;
  if (config.commitTrailers) {
    // Template expansions can produce broken trailers
    trailers = filterValidCommitTrailers(
      config.commitTrailers.map((trailer) => compile(trailer, trailersContext)),
    );
    logger.trace(`commitTrailers: ${JSON.stringify(trailers)}`);
  }

  return { message: compiledMessage, trailers };
}
