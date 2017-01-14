const CronJob = require('cron').CronJob;

new CronJob({
  cronTime: '0,20,40 * * * *', // Every 20 minutes
  onTick: require('../../app/index.js'),
  start: true,
  timeZone: 'America/Los_Angeles',
});
