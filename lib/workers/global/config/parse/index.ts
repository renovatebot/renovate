import is from '@sindresorhus/is';
import * as defaultsParser from '../../../../config/defaults';
import { applySecretsToConfig } from '../../../../config/secrets';
import type { AllConfig } from '../../../../config/types';
import { mergeChildConfig } from '../../../../config/utils';
import { logger, setContext } from '../../../../logger';
import { detectAllGlobalConfig } from '../../../../modules/manager';
import { coerceArray } from '../../../../util/array';
import { setCustomEnv } from '../../../../util/env';
import { readSystemFile } from '../../../../util/fs';
import { addSecretForSanitizing } from '../../../../util/sanitize';
import { ensureTrailingSlash } from '../../../../util/url';
import * as cliParser from './cli';
import * as codespaces from './codespaces';
import * as envParser from './env';
import * as fileParser from './file';
import { hostRulesFromEnv } from './host-rules-from-env';

export async function parseConfigs(
  env: NodeJS.ProcessEnv,
  argv: string[],
): Promise<AllConfig> {
  logger.debug('Parsing configs');

  // Get configs
  const defaultConfig = defaultsParser.getConfig();
  const fileConfig = await fileParser.getConfig(env);
  const cliConfig = cliParser.getConfig(argv);
  const envConfig = await envParser.getConfig(env);

  let config: AllConfig = mergeChildConfig(fileConfig, envConfig);
  config = mergeChildConfig(config, cliConfig);

  config = await codespaces.setConfig(config);

  const combinedConfig = config;

  config = mergeChildConfig(defaultConfig, config);

  if (config.forceCli) {
    const forcedCli = { ...cliConfig };
    delete forcedCli.token;
    delete forcedCli.hostRules;
    if (config.force) {
      config.force = { ...config.force, ...forcedCli };
    } else {
      config.force = forcedCli;
    }
  }

  if (!config.privateKey && config.privateKeyPath) {
    config.privateKey = await readSystemFile(config.privateKeyPath, 'utf8');
    delete config.privateKeyPath;
  }

  if (!config.privateKeyOld && config.privateKeyPathOld) {
    config.privateKeyOld = await readSystemFile(
      config.privateKeyPathOld,
      'utf8',
    );
    delete config.privateKeyPathOld;
  }

  addSecretForSanitizing(config.privateKey, 'global');
  addSecretForSanitizing(config.privateKeyOld, 'global');

  if (config.logContext) {
    // This only has an effect if logContext was defined via file or CLI, otherwise it would already have been detected in env
    setContext(config.logContext);
  }

  logger.trace({ config: defaultConfig }, 'Default config');
  logger.debug({ config: fileConfig }, 'File config');
  logger.debug({ config: cliConfig }, 'CLI config');
  logger.debug({ config: envConfig }, 'Env config');
  logger.debug({ config: combinedConfig }, 'Combined config');

  if (config.detectGlobalManagerConfig) {
    logger.debug('Detecting global manager config');
    const globalManagerConfig = await detectAllGlobalConfig();
    logger.debug({ config: globalManagerConfig }, 'Global manager config');
    config = mergeChildConfig(config, globalManagerConfig);
  }

  if (config.detectHostRulesFromEnv) {
    const hostRules = hostRulesFromEnv(env);
    config.hostRules = [...coerceArray(config.hostRules), ...hostRules];
  }
  // Get global config
  logger.trace({ config }, 'Full config');

  // Massage endpoint to have a trailing slash
  if (config.endpoint) {
    logger.debug('Adding trailing slash to endpoint');
    config.endpoint = ensureTrailingSlash(config.endpoint);
  }

  // Massage forkProcessing
  if (!config.autodiscover && config.forkProcessing !== 'disabled') {
    logger.debug('Enabling forkProcessing while in non-autodiscover mode');
    config.forkProcessing = 'enabled';
  }

  // Only try deletion if RENOVATE_CONFIG_FILE is set
  await fileParser.deleteNonDefaultConfig(env, !!config.deleteConfigFile);

  // Massage onboardingNoDeps
  if (!config.autodiscover && config.onboardingNoDeps !== 'disabled') {
    logger.debug('Enabling onboardingNoDeps while in non-autodiscover mode');
    config.onboardingNoDeps = 'enabled';
  }

  // do not add these secrets to repoSecrets and,
  //  do not delete the secrets object after applying on global config as it needs to be re-used for repo config
  if (is.nonEmptyObject(config.secrets)) {
    config = applySecretsToConfig(config, undefined, false);
    // adding these secrets to the globalSecrets set so that they can be redacted from logs
    for (const secret of Object.values(config.secrets!)) {
      addSecretForSanitizing(secret, 'global');
    }
  }

  if (is.nonEmptyObject(config.customEnvVariables)) {
    setCustomEnv(config.customEnvVariables);
  }

  return config;
}
