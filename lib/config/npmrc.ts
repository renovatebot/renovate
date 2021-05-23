import ini from 'ini';
import { id as hostType } from '../datasource/npm';
import { RenovateConfig } from './types';

function getMatchHost(input: string): string {
  if (input.startsWith('https://')) {
    return input;
  }
  return input.split('//')[1];
}

export function getConfigFromNpmrc(npmrc = ''): RenovateConfig {
  const res: RenovateConfig = {};
  const parsed = ini.parse(npmrc);
  for (const [key, val] of Object.entries(parsed)) {
    // hostRules
    if (key === '_auth') {
      res.hostRules ||= [];
      res.hostRules.push({
        hostType,
        authType: 'Basic',
        token: val,
      });
    } else if (key === '_authToken') {
      res.hostRules ||= [];
      res.hostRules.push({ hostType, token: val });
    } else if (key.endsWith(':_auth')) {
      const hostPart = key.replace(/:_auth$/, '');
      res.hostRules ||= [];
      res.hostRules.push({
        hostType,
        matchHost: getMatchHost(hostPart),
        authType: 'Basic',
        token: val,
      });
    } else if (key.endsWith(':_authToken')) {
      const hostPart = key.replace(/:_authToken$/, '');
      res.hostRules ||= [];
      res.hostRules.push({
        hostType,
        matchHost: getMatchHost(hostPart),
        token: val,
      });
      // packageRules
    } else if (key === 'registry') {
      const [, host] = val.split('//');
      res.packageRules ||= [];
      res.packageRules.push({
        matchDatasources: [hostType],
        registryUrls: [`https://${host}`],
      });
    } else if (key.endsWith(':registry')) {
      const [scope] = key.split(':');
      const [, host] = val.split('//');
      res.packageRules ||= [];
      res.packageRules.push({
        matchDatasources: [hostType],
        matchPackagePrefixes: [scope],
        registryUrls: [`https://${host}`],
      });
    }
  }
  return res;
}
