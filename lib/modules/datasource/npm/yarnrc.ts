import { load } from 'js-yaml';
import type { HostRule } from '../../../types/host-rules';
import type { NpmrcRules } from './types';

interface YarnrcYAML {
  npmAuthToken?: string;
  npmRegistryServer?: string;
  npmScopes?: {
    [key: string]: {
      npmAuthToken?: string;
      npmRegistryServer?: string;
    };
  };
}

export function convertYarnrcYmlToRules(yarnrcYml: string): NpmrcRules {
  const rules: NpmrcRules = {
    hostRules: [],
    packageRules: [],
  };
  const hosts: Map<string, HostRule> = new Map();

  const yarnrc = load(yarnrcYml, {
    json: true,
  }) as YarnrcYAML;

  const { npmAuthToken, npmRegistryServer, npmScopes } = yarnrc;

  if (npmRegistryServer) {
    const rule: HostRule = hosts.get(npmRegistryServer) || {
      hostType: 'npm',
      matchHost: npmRegistryServer,
    };
    if (npmAuthToken) {
      rule.token = npmAuthToken;
    }
    hosts.set(npmRegistryServer, rule);
    rules.hostRules.push(rule);
  }

  if (npmScopes) {
    const matchDatasources = ['npm'];

    for (const scope of Object.keys(npmScopes)) {
      const {
        npmAuthToken: scopedAuthToken,
        npmRegistryServer: scopedRegistryServer,
      } = npmScopes[scope];

      if (scopedRegistryServer) {
        rules.packageRules?.push({
          matchDatasources,
          matchPackagePrefixes: [`${scope}/`],
          registryUrls: [scopedRegistryServer],
        });

        if (scopedAuthToken) {
          let rule = hosts.get(scopedRegistryServer);
          if (rule) {
            rule.token = scopedAuthToken;
          } else {
            rule = {
              hostType: 'npm',
              matchHost: scopedRegistryServer,
              token: scopedAuthToken,
            };
            hosts.set(scopedRegistryServer, rule);
            rules.hostRules.push(rule);
          }
        }
      }
    }
  }

  return rules;
}
