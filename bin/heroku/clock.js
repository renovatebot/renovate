const CronJob = require('cron').CronJob;

new CronJob({
  cronTime: '*/5 * * * *', // Every 5 mins
  onTick: require('../../app/index.js'),
  start: true,
  timeZone: 'America/Los_Angeles',
});
