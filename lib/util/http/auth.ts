import is from '@sindresorhus/is';
import type { Options } from 'got';
import {
  GITEA_API_USING_HOST_TYPES,
  GITHUB_API_USING_HOST_TYPES,
  GITLAB_API_USING_HOST_TYPES,
} from '../../constants';
import type { GotOptions } from './types';

export type AuthGotOptions = Pick<
  GotOptions,
  | 'hostType'
  | 'headers'
  | 'noAuth'
  | 'context'
  | 'token'
  | 'username'
  | 'password'
>;

export function applyAuthorization<GotOptions extends AuthGotOptions>(
  inOptions: GotOptions,
): GotOptions {
  const options: GotOptions = { ...inOptions };

  if (is.nonEmptyString(options.headers?.authorization) || options.noAuth) {
    return options;
  }

  options.headers ??= {};
  if (options.token) {
    if (
      options.hostType &&
      GITEA_API_USING_HOST_TYPES.includes(options.hostType)
    ) {
      options.headers.authorization = `token ${options.token}`;
    } else if (
      options.hostType &&
      GITHUB_API_USING_HOST_TYPES.includes(options.hostType)
    ) {
      options.headers.authorization = `token ${options.token}`;
      if (options.token.startsWith('x-access-token:')) {
        const appToken = options.token.replace('x-access-token:', '');
        options.headers.authorization = `token ${appToken}`;
        if (is.string(options.headers.accept)) {
          options.headers.accept = options.headers.accept.replace(
            'application/vnd.github.v3+json',
            'application/vnd.github.machine-man-preview+json',
          );
        }
      }
    } else if (
      options.hostType &&
      GITLAB_API_USING_HOST_TYPES.includes(options.hostType)
    ) {
      // GitLab versions earlier than 12.2 only support authentication with
      // a personal access token, which is 20 characters long.
      if (options.token.length === 20) {
        options.headers['Private-token'] = options.token;
      } else {
        options.headers.authorization = `Bearer ${options.token}`;
      }
    } else {
      // Custom Auth type, eg `Basic XXXX_TOKEN`
      const type = options.context?.authType ?? 'Bearer';

      if (type === 'Token-Only') {
        options.headers.authorization = options.token;
      } else {
        options.headers.authorization = `${type} ${options.token}`;
      }
    }
    delete options.token;
  } else if (options.password !== undefined) {
    // Otherwise got will add username and password to url and header
    const auth = Buffer.from(
      `${options.username ?? ''}:${options.password}`,
    ).toString('base64');
    options.headers.authorization = `Basic ${auth}`;
    delete options.username;
    delete options.password;
  }
  return options;
}

// isAmazon return true if request options contains Amazon related headers
function isAmazon(options: Options): boolean {
  return !!options.search?.includes('X-Amz-Algorithm');
}

// isAzureBlob return true if request options contains Azure container registry related data
function isAzureBlob(options: Options): boolean {
  return !!(
    options.hostname?.endsWith('.blob.core.windows.net') && // lgtm [js/incomplete-url-substring-sanitization]
    options.href?.includes('/docker/registry')
  );
}

// removeAuthorization from the redirect options
export function removeAuthorization(options: Options): void {
  if (!options.password && !options.headers?.authorization) {
    return;
  }

  // Check if request has been redirected to Amazon or an Azure blob (ACR)
  if (isAmazon(options) || isAzureBlob(options)) {
    // if there is no port in the redirect URL string, then delete it from the redirect options.
    // This can be evaluated for removal after upgrading to Got v10
    const portInUrl = options.href?.split?.('/')?.[2]?.split(':')?.[1];
    // istanbul ignore next
    if (!portInUrl) {
      delete options.port; // Redirect will instead use 80 or 443 for HTTP or HTTPS respectively
    }

    // registry is hosted on Amazon or Azure blob, redirect url includes
    // authentication which is not required and should be removed
    if (options?.headers?.authorization) {
      delete options.headers.authorization;
    }
    delete options.username;
    delete options.password;
  }
}
