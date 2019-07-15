const got = require('got');
const { logger } = require('../../logger');

let stats = {};

// istanbul ignore next
module.exports.resetStats = () => {
  stats = {};
};

// istanbul ignore next
module.exports.printStats = () => {
  logger.trace({ stats }, 'Host transfer stats (milliseconds)');
  const hostStats = {};
  for (const [hostname, entries] of Object.entries(stats)) {
    const res = {};
    res.requests = entries.length;
    res.sum = 0;
    entries.forEach(entry => {
      res.sum += entry;
    });
    res.average = Math.round(res.sum / res.requests);
    res.median = entries[Math.floor(entries.length / 2)];
    hostStats[hostname] = res;
  }
  logger.debug({ hostStats }, 'Host request stats (milliseconds)');
};

module.exports.instance = got.create({
  options: {},
  handler: (options, next) => {
    const start = new Date();
    const nextPromise = next(options);
    nextPromise.on('response', () => {
      const elapsed = new Date() - start;
      stats[options.hostname] = stats[options.hostname] || [];
      stats[options.hostname].push(elapsed);
    });
    return nextPromise;
  },
});
