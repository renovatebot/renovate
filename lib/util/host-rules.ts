import URL from 'url';

export const defaults: IDict<IPlatformConfig> = {
  bitbucket: { name: 'Bitbucket', endpoint: 'https://api.bitbucket.org/' },
  'bitbucket-server': { name: 'Bitbucket Server' },
  github: { name: 'GitHub', endpoint: 'https://api.github.com/' },
  gitlab: { name: 'GitLab', endpoint: 'https://gitlab.com/api/v4/' },
  azure: { name: 'Azure DevOps' },
};

// TODO: add known properties
export interface IPlatformConfig {
  [prop: string]: any;
  name?: string;
  endpoint?: string;

  token?: string;
}
interface IDict<T> {
  [key: string]: T;
}
const platforms: IDict<IPlatformConfig> = {};
const hostsOnly: IDict<IPlatformConfig> = {};

export function update(params: IPlatformConfig) {
  const { platform } = params;
  if (!platform) {
    if (params.endpoint) {
      const { host } = URL.parse(params.endpoint);
      hostsOnly[host!] = params;
      return true;
    }
    throw new Error(
      'Failed to set configuration: no platform or endpoint specified'
    );
  }
  const config = { ...params };
  const { endpoint } = config;
  if (!endpoint) {
    // istanbul ignore if
    if (platform === 'docker') {
      platforms.docker = params;
      return true;
    }
    throw new Error(
      `Failed to configure platform '${platform}': no endpoint defined`
    );
  }
  config.endpoint = endpoint.replace(/[^/]$/, '$&/');
  let { host } = config;
  // extract host from endpoint
  host = host || (endpoint && URL.parse(endpoint).host);
  // endpoint is in the format host/path (protocol missing)
  host = host || (endpoint && URL.parse('http://' + endpoint).host);
  if (!host) {
    throw new Error(
      `Failed to configure platform '${platform}': no host for endpoint '${endpoint}'`
    );
  }
  platforms[platform] = { ...platforms[platform] };
  logger.debug({ config }, 'Setting hostRule');
  platforms[platform][host] = { ...platforms[platform][host], ...config };
  return true;
}

export function find(
  {
    platform,
    host,
    endpoint,
  }: { platform: string; host?: string; endpoint?: string },
  overrides?: IPlatformConfig
) {
  const massagedHost =
    host || (endpoint ? URL.parse(endpoint).host : undefined);
  if (!platforms[platform]) {
    if (massagedHost && hostsOnly[massagedHost]) {
      return merge(hostsOnly[massagedHost], overrides);
    }
    return merge(null, overrides);
  }
  // istanbul ignore if
  if (platform === 'docker') {
    if (platforms.docker.platform === 'docker') {
      return merge(platforms.docker, overrides);
    }
    return merge(platforms.docker[massagedHost!], overrides);
  }
  if (massagedHost) {
    return merge(platforms[platform][massagedHost], overrides);
  }
  const configs = Object.values(platforms[platform]);
  let config;
  if (configs.length === 1) {
    [config] = configs;
  }
  return merge(config, overrides);
}

export function hosts({ platform }: { platform: string }) {
  return Object.keys({ ...platforms[platform] });
}

function merge(config: IPlatformConfig | null, overrides?: IPlatformConfig) {
  if (!overrides) {
    return config || null;
  }
  const locals = { ...overrides };
  Object.keys(locals).forEach(key => {
    if (locals[key] === undefined || locals[key] === null) {
      delete locals[key];
    }
  });
  return { ...config, ...locals };
}

export function clear() {
  Object.keys(platforms).forEach(key => delete platforms[key]);
}
