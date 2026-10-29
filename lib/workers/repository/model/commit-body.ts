import type { RenovateConfig } from '../../../config/types.ts';
import { logger } from '../../../logger/index.ts';
import { filterValidCommitTrailers } from '../../../util/git/commit-trailers.ts';
import { compile } from '../../../util/template/index.ts';
import { withoutUrlCredentials } from '../../../util/url.ts';

/**
 * Appends the compiled `commitBody` to `message`, without URL credentials, or returns `message` unchanged when no `commitBody` is configured.
 */
export function compileCommitBody(
  config: Pick<RenovateConfig, 'commitBody'>,
  message: string,
  context: object,
): string {
  if (!config.commitBody) {
    return message;
  }

  const compiledMessage = `${message}\n\n${withoutUrlCredentials(compile(config.commitBody, context))}`;
  logger.trace(`commitMessage: ${JSON.stringify(compiledMessage)}`);
  return compiledMessage;
}

/**
 * Compiles `commitTrailers` without URL credentials and drops the ones that are invalid after compilation, or returns `undefined` when none are configured.
 */
export function compileCommitTrailers(
  config: Pick<RenovateConfig, 'commitTrailers'>,
  context: object,
): string[] | undefined {
  if (!config.commitTrailers) {
    return undefined;
  }

  // Template expansions can produce broken trailers
  const trailers = filterValidCommitTrailers(
    config.commitTrailers.map((trailer) =>
      withoutUrlCredentials(compile(trailer, context)),
    ),
  );
  logger.trace(`commitTrailers: ${JSON.stringify(trailers)}`);
  return trailers;
}
