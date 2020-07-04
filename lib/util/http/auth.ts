import {
  PLATFORM_TYPE_GITEA,
  PLATFORM_TYPE_GITHUB,
  PLATFORM_TYPE_GITLAB,
} from '../../constants/platforms';

export function applyAuthorization(inOptions: any): any {
  const options = { ...inOptions };
  if (options.auth || options.headers?.authorization) {
    return options;
  }
  if (options.token) {
    if (
      options.hostType === PLATFORM_TYPE_GITHUB ||
      options.hostType === PLATFORM_TYPE_GITEA
    ) {
      options.headers.authorization = `token ${options.token}`;
    } else if (options.hostType === PLATFORM_TYPE_GITLAB) {
      options.headers['Private-token'] = options.token;
    } else {
      options.headers.authorization = `Bearer ${options.token}`;
    }
    delete options.token;
  }
  return options;
}

// isAmazon return true if request options contains Amazon related headers
function isAmazon(options: any): boolean {
  return options.search?.includes('X-Amz-Algorithm');
}

// isAzureBlob return true if request options contains Azure container registry related data
function isAzureBlob(options: any): boolean {
  return (
    options.hostname?.endsWith('.blob.core.windows.net') && // lgtm [js/incomplete-url-substring-sanitization]
    options.href?.includes('/docker/registry')
  );
}

// removeAuthorization from the redirect options
export function removeAuthorization(options: any): void {
  if (!options.auth && !options.headers?.authorization) {
    return;
  }

  // Check if request has been redirected to Amazon or an Azure blob (ACR)
  if (isAmazon(options) || isAzureBlob(options)) {
    // if there is no port in the redirect URL string, then delete it from the redirect options.
    // This can be evaluated for removal after upgrading to Got v10
    const portInUrl = options.href.split('/')[2].split(':')[1];
    if (!portInUrl) {
      // eslint-disable-next-line no-param-reassign
      delete options.port; // Redirect will instead use 80 or 443 for HTTP or HTTPS respectively
    }

    // registry is hosted on Amazon or Azure blob, redirect url includes
    // authentication which is not required and should be removed
    delete options.headers.authorization; // eslint-disable-line no-param-reassign
    delete options.auth; // eslint-disable-line no-param-reassign
  }
}
