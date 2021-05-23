import ini from 'ini';
import { id as hostType } from '../datasource/npm';
import { validateUrl } from '../util/url';
import { RenovateConfig } from './types';

export function getConfigFromNpmrc(npmrc = ''): RenovateConfig {
  const res: RenovateConfig = { hostRules: [], packageRules: [] };
  const parsed = ini.parse(npmrc);
  for (const [key, val] of Object.entries(parsed)) {
    // hostRules
    if (key === '_auth') {
      res.hostRules.push({
        hostType,
        authType: 'Basic',
        token: val,
      });
    } else if (key === '_authToken') {
      res.hostRules ||= [];
      res.hostRules.push({ hostType, token: val });
    } else if (key.endsWith(':_auth')) {
      const matchHost = key.replace(/:_auth$/, '').replace(/^\/\//, '');
      res.hostRules.push({
        hostType,
        matchHost,
        authType: 'Basic',
        token: val,
      });
    } else if (key.endsWith(':_authToken')) {
      const matchHost = key.replace(/:_authToken$/, '').replace(/^\/\//, '');
      res.hostRules.push({
        hostType,
        matchHost,
        token: val,
      });
      // packageRules
    } else if (key === 'registry') {
      if (validateUrl(val, false)) {
        res.packageRules.push({
          matchDatasources: [hostType],
          registryUrls: [val],
        });
      }
    } else if (key.endsWith(':registry')) {
      if (validateUrl(val, false)) {
        const [scope] = key.split(':');
        res.packageRules.push({
          matchDatasources: [hostType],
          matchPackagePrefixes: [scope],
          registryUrls: [val],
        });
      }
    }
  }
  return res;
}
