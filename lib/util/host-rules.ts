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

function copy(config: object) {
  return JSON.parse(JSON.stringify(config || null));
}

export function find({
  hostType,
  host,
  endpoint,
}: {
  hostType: string;
  host?: string;
  endpoint?: string;
}) {
  const massagedHost =
    host || (endpoint ? URL.parse(endpoint).host : undefined);
  if (!hostTypes[hostType]) {
    if (massagedHost && hostsOnly[massagedHost]) {
      return copy(hostsOnly[massagedHost]);
    }
    return null;
  }
  // istanbul ignore if
  if (hostType === 'docker') {
    if (hostTypes.docker.hostType === 'docker') {
      return copy(hostTypes.docker);
    }
    return copy(hostTypes.docker[massagedHost!]);
  }
  if (massagedHost) {
    return copy(hostTypes[hostType][massagedHost]);
  }
  const configs = Object.values(hostTypes[hostType]);
  let config;
  if (configs.length === 1) {
    [config] = configs;
  }
  return copy(config);
}

export function hosts({ hostType }: { hostType: string }) {
  return Object.keys({ ...hostTypes[hostType] });
}

export function clear() {
  Object.keys(hostTypes).forEach(key => delete hostTypes[key]);
}
