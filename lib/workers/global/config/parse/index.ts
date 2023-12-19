import * as defaultsParser from '../../../../config/defaults';
import type { AllConfig } from '../../../../config/types';
import { mergeChildConfig } from '../../../../config/utils';
import { addStream, logger, setContext } from '../../../../logger';
import { detectAllGlobalConfig } from '../../../../modules/manager';
import { coerceArray } from '../../../../util/array';
import { ensureDir, getParentDir, readSystemFile } from '../../../../util/fs';
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

  // Add file logger
  // istanbul ignore if
  if (config.logFile) {
    logger.debug(
      // TODO: types (#22198)
      `Enabling ${config.logFileLevel!} logging to ${config.logFile}`,
    );
    await ensureDir(getParentDir(config.logFile));
    addStream({
      name: 'logfile',
      path: config.logFile,
      level: config.logFileLevel,
    });
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

  // Remove log file entries
  delete config.logFile;
  delete config.logFileLevel;

  return config;
}
