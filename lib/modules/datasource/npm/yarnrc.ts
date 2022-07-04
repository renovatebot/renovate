import { load } from 'js-yaml';

interface YarnrcYAML {
  npmAlwaysAuth?: boolean;
  npmAuthToken?: string;
  npmRegistryServer?: string;
  npmScopes?: {
    [key: string]: {
      npmAlwaysAuth?: boolean;
      npmAuthToken?: string;
      npmRegistryServer?: string;
    };
  };
}

export function convertYarnrcYmlToNpmrc(yarnrcYml: string): string {
  const yarnrc = load(yarnrcYml, {
    json: true,
  }) as YarnrcYAML;

  const npmrc: string[] = [];

  const { npmAlwaysAuth, npmAuthToken, npmRegistryServer, npmScopes } = yarnrc;

  if (npmRegistryServer) {
    npmrc.push(`registry=${npmRegistryServer}`);
    if (npmAuthToken) {
      npmrc.push(`${npmRegistryServer}:_authToken=${npmAuthToken}`);
    }
    if (npmAlwaysAuth) {
      npmrc.push(`${npmRegistryServer}:_always-auth=true`);
    }
  }

  if (npmScopes) {
    for (const npmScope of Object.keys(npmScopes)) {
      const {
        npmAlwaysAuth: scopedAlwaysAuth,
        npmAuthToken: scopedAuthToken,
        npmRegistryServer: scopedRegistryServer,
      } = npmScopes[npmScope];

      npmrc.push(`@${npmScope}:registry=${scopedRegistryServer}`);
      if (scopedAuthToken) {
        npmrc.push(`${scopedRegistryServer}:_authToken=${scopedAuthToken}`);
      }
      if (scopedAlwaysAuth) {
        npmrc.push(`${scopedRegistryServer}:_always-auth=true`);
      }
    }
  }

  return npmrc.join('\n');
}
