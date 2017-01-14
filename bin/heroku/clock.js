const CronJob = require('cron').CronJob;
const renovate = require('../../app/renovate');

new CronJob({
  cronTime: '*/5 * * * *', // Every 5 mins
  onTick: renovate.start(),
  start: true,
  timeZone: 'America/Los_Angeles',
});
