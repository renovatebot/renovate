const CronJob = require('cron').CronJob;

new CronJob({
  cronTime: '0 * * * *', // Every hour
  onTick: require('../../app/index.js'),
  start: true,
  timeZone: 'America/Los_Angeles',
});
