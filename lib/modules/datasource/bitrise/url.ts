import { parseGitUrl } from '../../../util/git/url.ts';
import { regEx } from '../../../util/regex.ts';

const publicRegistry = regEx(
  /^(?:https?:\/\/|ssh:\/\/(?:git@)?)github\.com(?::\d+)?\/bitrise-io\/bitrise-steplib(?:\.git)?\/?$/i,
);

export function isPublicRegistry(registryUrl: string | undefined): boolean {
  if (!registryUrl) {
    return false;
  }

  let parsedUrl: ReturnType<typeof parseGitUrl>;
  let decodedUrl: string;
  try {
    parsedUrl = parseGitUrl(registryUrl);
    decodedUrl = decodeURIComponent(registryUrl);
  } catch {
    return false;
  }

  if (parsedUrl.resource !== 'github.com') {
    return false;
  }

  if (parsedUrl.full_name.toLowerCase() !== 'bitrise-io/bitrise-steplib') {
    return false;
  }

  return publicRegistry.test(decodedUrl);
}
