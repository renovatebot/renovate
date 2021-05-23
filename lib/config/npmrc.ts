import ini from 'ini';
import { id as hostType } from '../datasource/npm';
import { RenovateConfig } from './types';

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
      const [hostPart] = key.replace(/^https?:/, '').split(':');
      const [, matchHost] = hostPart.split('//');
      res.hostRules ||= [];
      res.hostRules.push({
        hostType,
        matchHost,
        authType: 'Basic',
        token: val,
      });
    } else if (key.endsWith(':_authToken')) {
      const [hostPart] = key.split(':');
      const [, matchHost] = hostPart.split('//');
      res.hostRules ||= [];
      res.hostRules.push({
        hostType,
        matchHost,
        token: val,
      });
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
