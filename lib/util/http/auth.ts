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
