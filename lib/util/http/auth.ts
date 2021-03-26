import is from '@sindresorhus/is';
import { NormalizedOptions } from 'got';
import {
  PLATFORM_TYPE_GITEA,
  PLATFORM_TYPE_GITHUB,
  PLATFORM_TYPE_GITLAB,
} from '../../constants/platforms';
import { GotOptions } from './types';

export function applyAuthorization(inOptions: GotOptions): GotOptions {
  const options = { ...inOptions };
  if (options.headers?.authorization) {
    return options;
  }
  if (options.token) {
    if (options.hostType === PLATFORM_TYPE_GITEA) {
      options.headers.authorization = `token ${options.token}`;
    } else if (options.hostType === PLATFORM_TYPE_GITHUB) {
      options.headers.authorization = `token ${options.token}`;
      if (options.token.startsWith('x-access-token:')) {
        const appToken = options.token.replace('x-access-token:', '');
        options.headers.authorization = `token ${appToken}`;
        if (is.string(options.headers.accept)) {
          options.headers.accept = options.headers.accept.replace(
            'application/vnd.github.v3+json',
            'application/vnd.github.machine-man-preview+json'
          );
        }
      }
    } else if (options.hostType === PLATFORM_TYPE_GITLAB) {
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
      options.headers.authorization = `${type} ${options.token}`;
    }
    delete options.token;
  } else if (options.password !== undefined) {
    // Otherwise got will add username and password to url and header
    const auth = Buffer.from(
      `${options.username || ''}:${options.password}`
    ).toString('base64');
    options.headers.authorization = `Basic ${auth}`;
    delete options.username;
    delete options.password;
  }
  return options;
}

// isAmazon return true if request options contains Amazon related headers
function isAmazon(options: NormalizedOptions): boolean {
  return options.search?.includes('X-Amz-Algorithm');
}

// isAzureBlob return true if request options contains Azure container registry related data
function isAzureBlob(options: NormalizedOptions): boolean {
  return (
    options.hostname?.endsWith('.blob.core.windows.net') && // lgtm [js/incomplete-url-substring-sanitization]
    options.href?.includes('/docker/registry')
  );
}

// removeAuthorization from the redirect options
export function removeAuthorization(options: NormalizedOptions): void {
  if (!options.password && !options.headers?.authorization) {
    return;
  }

  // Check if request has been redirected to Amazon or an Azure blob (ACR)
  if (isAmazon(options) || isAzureBlob(options)) {
    // if there is no port in the redirect URL string, then delete it from the redirect options.
    // This can be evaluated for removal after upgrading to Got v10
    const portInUrl = options.href.split('/')[2].split(':')[1];
    // istanbul ignore next
    if (!portInUrl) {
      // eslint-disable-next-line no-param-reassign
      delete options.port; // Redirect will instead use 80 or 443 for HTTP or HTTPS respectively
    }

    // registry is hosted on Amazon or Azure blob, redirect url includes
    // authentication which is not required and should be removed
    delete options.headers.authorization; // eslint-disable-line no-param-reassign
    delete options.username; // eslint-disable-line no-param-reassign
    delete options.password; // eslint-disable-line no-param-reassign
  }
}
