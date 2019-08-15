import { logger, levels, addStream } from '../logger';
import * as definitions from './definitions';
import * as defaultsParser from './defaults';
import * as fileParser from './file';
import * as cliParser from './cli';
import * as envParser from './env';

import { resolveConfigPresets } from './presets';
import { get, getLanguageList, getManagerList } from '../manager';

const clone = input => JSON.parse(JSON.stringify(input));

export function getManagerConfig(config, manager) {
  let managerConfig = config;
  const language = get(manager, 'language');
  if (language) {
    managerConfig = mergeChildConfig(managerConfig, config[language]);
  }
  managerConfig = mergeChildConfig(managerConfig, config[manager]);
  for (const i of getLanguageList().concat(getManagerList())) {
    delete managerConfig[i];
  }
  managerConfig.language = language;
  managerConfig.manager = manager;
  return managerConfig;
}

export async function parseConfigs(env, argv) {
  logger.debug('Parsing configs');

  // Get configs
  const defaultConfig = await resolveConfigPresets(defaultsParser.getConfig());
  const fileConfig = await resolveConfigPresets(fileParser.getConfig(env));
  const cliConfig = await resolveConfigPresets(cliParser.getConfig(argv));
  const envConfig = await resolveConfigPresets(envParser.getConfig(env));

  let config = mergeChildConfig(fileConfig, envConfig);
  config = mergeChildConfig(config, cliConfig);

  const combinedConfig = config;

  config = mergeChildConfig(defaultConfig, config);

  if (config.prFooter !== defaultConfig.prFooter) {
    config.customPrFooter = true;
  }

  if (config.forceCli) {
    config = mergeChildConfig(config, { force: { ...cliConfig } });
  }

  // Set log level
  levels('stdout', config.logLevel);

  // Add file logger
  // istanbul ignore if
  if (config.logFile) {
    logger.debug(
      `Enabling ${config.logFileLevel} logging to ${config.logFile}`
    );
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

  // Get global config
  logger.trace({ config }, 'Full config');

  // Print config
  logger.trace({ config }, 'Global config');
  // Remove log file entries
  delete config.logFile;
  delete config.logFileLevel;
  return config;
}

export function mergeChildConfig(parent, child) {
  logger.trace({ parent, child }, `mergeChildConfig`);
  if (!child) {
    return parent;
  }
  const parentConfig = clone(parent);
  const childConfig = clone(child);
  const config = { ...parentConfig, ...childConfig };
  for (const option of definitions.getOptions()) {
    if (
      option.mergeable &&
      childConfig[option.name] &&
      parentConfig[option.name]
    ) {
      logger.trace(`mergeable option: ${option.name}`);
      if (option.type === 'array') {
        config[option.name] = (parentConfig[option.name] || []).concat(
          config[option.name] || []
        );
      } else {
        config[option.name] = mergeChildConfig(
          parentConfig[option.name],
          childConfig[option.name]
        );
      }
      logger.trace(
        { result: config[option.name] },
        `Merged config.${option.name}`
      );
    }
  }
  return Object.assign(config, config.force);
}

export function filterConfig(inputConfig, targetStage) {
  logger.trace({ config: inputConfig }, `filterConfig('${targetStage}')`);
  const outputConfig = { ...inputConfig };
  const stages = ['global', 'repository', 'package', 'branch', 'pr'];
  const targetIndex = stages.indexOf(targetStage);
  for (const option of definitions.getOptions()) {
    const optionIndex = stages.indexOf(option.stage);
    if (optionIndex !== -1 && optionIndex < targetIndex) {
      delete outputConfig[option.name];
    }
  }
  return outputConfig;
}
