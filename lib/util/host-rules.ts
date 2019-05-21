import URL from 'url';

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
const hostTypes: IDict<IPlatformConfig> = {};
const hostsOnly: IDict<IPlatformConfig> = {};

export function update(params: IPlatformConfig) {
  debugger;
  const { hostType } = params;
  if (!hostType) {
    if (params.endpoint) {
      const { host } = URL.parse(params.endpoint);
      hostsOnly[host!] = params;
      return true;
    }
    throw new Error(
      'Failed to set configuration: no hostType or endpoint specified'
    );
  }
  const config = { ...params };
  const { endpoint } = config;
  if (!endpoint) {
    // istanbul ignore if
    if (hostType === 'docker') {
      hostTypes.docker = params;
      return true;
    }
    throw new Error(
      `Failed to configure hostType '${hostType}': no endpoint defined`
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
      `Failed to configure hostType '${hostType}': no host for endpoint '${endpoint}'`
    );
  }
  hostTypes[hostType] = { ...hostTypes[hostType] };
  logger.debug({ config }, 'Setting hostRule');
  hostTypes[hostType][host] = { ...hostTypes[hostType][host], ...config };
  return true;
}

export function find(
  {
    hostType,
    host,
    endpoint,
  }: { hostType: string; host?: string; endpoint?: string },
  overrides?: IPlatformConfig
) {
  const massagedHost = host
    ? host
    : endpoint
    ? URL.parse(endpoint).host
    : undefined;
  if (!hostTypes[hostType]) {
    if (massagedHost && hostsOnly[massagedHost]) {
      return merge(hostsOnly[massagedHost], overrides);
    }
    return merge(null, overrides);
  }
  // istanbul ignore if
  if (hostType === 'docker') {
    if (hostTypes.docker.hostType === 'docker') {
      return merge(hostTypes.docker, overrides);
    }
    return merge(hostTypes.docker[massagedHost!], overrides);
  }
  if (massagedHost) {
    return merge(hostTypes[hostType][massagedHost], overrides);
  }
  const configs = Object.values(hostTypes[hostType]);
  let config;
  if (configs.length === 1) {
    [config] = configs;
  }
  return merge(config, overrides);
}

export function hosts({ hostType }: { hostType: string }) {
  return Object.keys({ ...hostTypes[hostType] });
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
  Object.keys(hostTypes).forEach(key => delete hostTypes[key]);
}
