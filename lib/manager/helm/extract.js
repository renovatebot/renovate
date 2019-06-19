const upath = require('upath');
const yaml = require('js-yaml');
const is = require('@sindresorhus/is');

module.exports = {
  extractPackageFile,
};

async function extractPackageFile(content, fileName) {
  let chartName;
  try {
    const baseDir = upath.parse(fileName).dir;
    const chartFileName = upath.join(baseDir, 'Chart.yaml');
    const chart = await platform.getFile(chartFileName);
    if (!chart) {
      logger.warn('Failed to read Chart.yaml');
    }
    const doc = yaml.safeLoad(chart);
    chartName = doc.name;
  } catch (err) {
    logger.warn('Failed to parse Chart.yaml');
  }
  logger.info(`Chart name: ${chartName}`);
  logger.trace('helm.extractPackageFile()');
  let deps = [];
  try {
    const doc = yaml.safeLoad(content);
    if (doc && is.array(doc.dependencies)) {
      deps = doc.dependencies.map(dep => {
        const res = {
          depName: dep.name,
          currentValue: dep.version,
          helmRepository: dep.repository,
        };
        const url = new URL(dep.repository);
        if (url.protocol === 'file:') {
          res.skipReason = 'local-dependency';
        }
        return res;
      });
    }
  } catch (err) {
    logger.warn(
      { err, fileName },
      'extractPackageFile failed to parse requirements.yaml file'
    );
  }
  if (deps.length === 0) {
    logger.debug(
      { fileName },
      "extractPackageFile didn't extract any dependencies"
    );
    return null;
  }
  const res = {
    deps,
    datasource: 'helm',
  };
  if (chartName) {
    res.chartName = chartName;
  }
  return res;
}
