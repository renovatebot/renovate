const uniq = require('lodash/uniq');
const noop = require('lodash/noop');
const curry = require('lodash/curry');
const { tmpdir } = require('os');
const { join, resolve } = require('path');
const { outputFile } = require('fs-extra');
const { exec } = require('child-process-promise');
const { isValid } = require('../../versioning/ruby');

const SECURE_LEVEL = 'high';
const DATASOURCE = 'rubygems';

const ENV = {
  SECURE: process.env,
  DANGER: {
    HOME: process.env.HOME,
    PATH: process.env.PATH,
  },
};

const SKIP_REASON = {
  EMPTY: 'no-version',
  INVALID: 'invalid-value',
};

const ERROR_MESSAGE = {
  DEPS: 'unable to extract deps from gemfile',
  REMOTES: 'unable to extract registryUrls from gemfile',
  RUBY: 'unable to extract ruby version from lockfile',
  BUNDLER: 'unable to extract bundler version from lockfile',
};

const getCmdEnv = level => (level === SECURE_LEVEL ? ENV.SECURE : ENV.DANGER);

const getCmdArgs = (...params) =>
  params.map(([name, value]) => `--${name}=${value}`).join(' ');

const buildEmptyResult = () => ({
  deps: [],
  registryUrls: {},
});

const packageMapper = ({
  platforms,
  name: depName,
  groups: depTypes,
  remotes: registryUrls,
  version: currentValue,
  defined_at: lineNumbers,
}) => {
  const extra =
    currentValue && isValid(currentValue)
      ? { datasource: DATASOURCE }
      : { skipReason: currentValue ? SKIP_REASON.INVALID : SKIP_REASON.EMPTY };

  return {
    ...extra,
    depName,
    depTypes,
    platforms,
    lineNumbers,
    currentValue,
    registryUrls,
  };
};

const createTempfile = async ({ content, name }) => {
  const tmpPath = tmpdir();
  const filePath = join(tmpPath, name);

  await outputFile(filePath, content);

  return filePath;
};

const createLogger = level => curry(logger[level], 2);

const createParser = type => async path => {
  const shell = true;
  const cwd = __dirname;
  const bin = './parser/parse';

  const args = getCmdArgs([type, resolve(path)]);
  const env = getCmdEnv(global.trustLevel);
  const { stdout } = await exec(`${bin} ${args}`, { cwd, shell, env });

  return JSON.parse(stdout);
};

const createNormalizer = reducers => data =>
  Object.keys(reducers).reduce(
    (accum, field) => ({
      ...accum,
      [field]: reducers[field](data),
    }),
    {}
  );

const createValidator = logger => validators => data => {
  Object.keys(validators).forEach(name =>
    validators[name](data) ? noop() : logger(ERROR_MESSAGE[name])
  );
};

const createExtractor = type => ({ reducers, validators }) => async name => {
  const logger = createLogger('info')({ [type]: name });

  const parser = createParser(type);
  const normalizer = createNormalizer(reducers);
  const validator = createValidator(logger)(validators);

  const content = await platform.getFile(name);
  if (!content) {
    logger(`${type} has no content`);
    return buildEmptyResult();
  }

  const path = await createTempfile({ name, content });
  const raw = await parser(path);
  const data = normalizer(raw);

  validator(data);

  return data;
};

const extractGemfile = createExtractor('gemfile')({
  reducers: {
    deps: ({ packages }) => packages.map(packageMapper),
    registryUrls: ({ packages }) =>
      packages.reduce((acc, { remotes }) => uniq([...acc, ...remotes]), []),
  },
  validators: {
    DEPS: ({ deps }) => deps.length,
    REMOTES: ({ registryUrls }) => registryUrls.length,
  },
});

const extractLockfile = createExtractor('lockfile')({
  reducers: {
    compatibility: ({ ruby_version: ruby, bundler_version: bundler }) => ({
      ruby,
      bundler,
    }),
  },
  validators: {
    RUBY: ({ compatibility: { ruby } }) => ruby,
    BUNDLER: ({ compatibility: { bundler } }) => bundler,
  },
});

module.exports = {
  extractGemfile,
  extractLockfile,
};
