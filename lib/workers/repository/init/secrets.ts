import { RenovateConfig } from '../../../config/common';
import * as sanitize from '../../../util/sanitize';

export function applySecrets(_config: RenovateConfig): RenovateConfig {
  if (!_config.secrets) {
    return _config;
  }
  const { secrets, ...config } = _config;
  let stringifiedConfig = JSON.stringify(config);
  for (const [secretName, secretValue] of Object.entries(secrets)) {
    // TODO: decrypt if necessary
    const secretString = JSON.stringify(secretValue)
      .replace(/^"/, '')
      .replace(/"$/, '');
    sanitize.add(secretString);
    const secretSubstitution = `{{ secrets.${secretName} }}`;
    while (stringifiedConfig.includes(secretSubstitution)) {
      stringifiedConfig = stringifiedConfig.replace(
        secretSubstitution,
        secretString
      );
    }
  }
  return JSON.parse(stringifiedConfig);
}
