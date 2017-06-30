const later = require('later');
const moment = require('moment-timezone');

module.exports = {
  hasValidSchedule,
  isPackageScheduled,
};

function hasValidSchedule(schedule, logger) {
  if (!Array.isArray(schedule)) {
    logger.debug(`Invalid schedule: ${JSON.stringify(schedule)}`);
    return false;
  }
  if (schedule.length === 0) {
    logger.debug('No schedule defined');
    return false;
  }
  if (schedule.length === 1 && schedule[0] === '') {
    logger.debug('Empty schedule');
    return false;
  }
  // return true if any schedule is valid
  return schedule.some(scheduleText => {
    const parsedSchedule = later.parse.text(scheduleText);
    if (parsedSchedule.error !== -1) {
      logger.debug(`Failed to parse schedule ${scheduleText}`);
      // It failed to parse
      return false;
    }
    if (!parsedSchedule.schedules.some(s => s.d || s.t_a || s.t_b)) {
      logger.debug('Schedule has no days of week or time of day');
      return false;
    }
    return true;
  });
}

function isPackageScheduled(config) {
  config.logger.debug(`Checking schedule ${JSON.stringify(config.schedule)}`);
  // Massage into array
  const configSchedule = typeof config.schedule === 'string'
    ? [config.schedule]
    : config.schedule;
  if (!module.exports.hasValidSchedule(configSchedule, config.logger)) {
    // Return true if the schedule is invalid
    return true;
  }
  let now = moment();
  // Adjust the time if repo is in a different timezone to renovate
  if (config.timezone) {
    try {
      now = moment().tz(config.timezone);
    } catch (err) {
      config.config.logger.warn(
        `Failed to convert to timezone ${config.timezone}`
      );
      // We keep going anyway
    }
  }
  // Get today in text form, e.g. "Monday";
  const currentDay = now.day();
  // Get the number of seconds since midnight
  const currentSeconds = now.hours() * 3600 + now.minutes * 60 + now.seconds();
  // Support a single string but massage to array for processing
  config.logger.debug(`Checking ${configSchedule.length} schedule(s)`);
  // We run if any schedule matches
  const isWithinSchedule = configSchedule.some(scheduleText => {
    config.logger.debug(`Checking schedule "${scheduleText}"`);
    const parsedSchedule = later.parse.text(scheduleText);
    if (parsedSchedule.error !== -1) {
      return false;
    }
    // Later library returns array of schedules
    return parsedSchedule.schedules.some(schedule => {
      // Check if days are defined
      if (schedule.d) {
        // We need to compare text instead of numbers because
        // 'moment' adjusts day of week for locale while 'later' does not
        const dowMap = [
          'Sunday',
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
        ];
        const scheduledDays = schedule.d.map(day => dowMap[day]);
        if (scheduledDays.indexOf(currentDay) === -1) {
          config.logger.debug(
            `Does not match schedule because ${currentDay} is not in ${scheduledDays}`
          );
          return false;
        }
      }
      // Check for start time
      if (schedule.t_a) {
        const startSeconds = schedule.t_a[0];
        if (currentSeconds < startSeconds) {
          config.logger.debug(
            `Does not match schedule because ${currentSeconds} is earlier than ${startSeconds}`
          );
          return false;
        }
      }
      // Check for end time
      if (schedule.t_b) {
        const endSeconds = schedule.t_b[0];
        if (currentSeconds > endSeconds) {
          config.logger.debug(
            `Does not match schedule because ${currentSeconds} is later than ${endSeconds}`
          );
          return false;
        }
      }
      config.logger.debug(`Matches schedule ${scheduleText}`);
      return true;
    });
  });
  if (!isWithinSchedule) {
    config.logger.debug('Package not scheduled');
    return false;
  }
  return true;
}
