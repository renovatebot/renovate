const CronJob = require('cron').CronJob;

new CronJob({
  cronTime: '48 * * * *', // Every hour
  onTick: require('../../app/index.js'),
  start: true,
  timeZone: 'America/Los_Angeles',
});
