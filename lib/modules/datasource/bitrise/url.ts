import { parseGitUrl } from '../../../util/git/url.ts';
import { regEx } from '../../../util/regex.ts';

const publicRegistry = regEx(
  /^(?:https?:\/\/|ssh:\/\/(?:git@)?)github\.com(?::\d+)?\/bitrise-io\/bitrise-steplib(?:\.git)?\/?$/i,
);

export function isPublicRegistry(registryUrl: string | undefined): boolean {
  if (!registryUrl) {
    return false;
  }

  try {
    const parsedUrl = parseGitUrl(registryUrl);
    // The raw URL is part of the cache key, so ignored selectors can leak secrets.
    return (
      parsedUrl.resource === 'github.com' &&
      parsedUrl.full_name.toLowerCase() === 'bitrise-io/bitrise-steplib' &&
      publicRegistry.test(decodeURIComponent(registryUrl))
    );
  } catch {
    return false;
  }
}
