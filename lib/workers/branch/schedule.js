const later = require('later');
const moment = require('moment-timezone');

module.exports = {
  hasValidSchedule,
  isScheduledNow,
};

function fixShortHours(input) {
  return input.replace(/( \d?\d)((a|p)m)/g, '$1:00$2');
}

function hasValidSchedule(schedule, logger) {
  if (!Array.isArray(schedule)) {
    logger.debug({ schedule }, `Invalid schedule`);
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
  // check if any of the schedules fail to parse
  const hasFailedSchedules = schedule.some(scheduleText => {
    const parsedSchedule = later.parse.text(fixShortHours(scheduleText));
    if (parsedSchedule.error !== -1) {
      logger.debug(`Failed to parse schedule ${scheduleText}`);
      // It failed to parse
      return true;
    }
    if (!parsedSchedule.schedules.some(s => s.d || s.t_a || s.t_b)) {
      logger.debug('Schedule has no days of week or time of day');
      return true;
    }
    // It must be OK
    return false;
  });
  if (hasFailedSchedules) {
    // If any fail then we invalidate the whole thing
    return false;
  }
  return true;
}

function isScheduledNow(config) {
  const { logger } = config;
  logger.debug({ schedule: config.schedule }, `Checking schedule`);
  if (!module.exports.hasValidSchedule(config.schedule, logger)) {
    // Return true if the schedule is invalid
    return true;
  }
  let now = moment();
  logger.debug(`now=${now.format()}`);
  // Adjust the time if repo is in a different timezone to renovate
  if (config.timezone) {
    // TODO: check for validity manually
    now = now.tz(config.timezone);
    logger.debug(`now=${now.format()}`);
  }
  // Get today in text form, e.g. "Monday";
  const currentDay = now.format('dddd');
  logger.debug(`currentDay=${currentDay}`);
  // Get the number of seconds since midnight
  const currentSeconds =
    now.hours() * 3600 + now.minutes() * 60 + now.seconds();
  logger.debug(`currentSeconds=${currentSeconds}`);
  // Support a single string but massage to array for processing
  logger.debug(`Checking ${config.schedule.length} schedule(s)`);
  // We run if any schedule matches
  const isWithinSchedule = config.schedule.some(scheduleText => {
    logger.debug(`Checking schedule "${scheduleText}"`);
    const parsedSchedule = later.parse.text(fixShortHours(scheduleText));
    // Later library returns array of schedules
    return parsedSchedule.schedules.some(schedule => {
      // Check if days are defined
      if (schedule.d) {
        logger.debug({ schedule_d: schedule.d }, `schedule.d`);
        // We need to compare text instead of numbers because
        // 'moment' adjusts day of week for locale while 'later' does not
        // later days run from 1..7
        const dowMap = [
          null,
          'Sunday',
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
        ];
        const scheduledDays = schedule.d.map(day => dowMap[day]);
        logger.debug({ scheduledDays }, `scheduledDays`);
        if (scheduledDays.indexOf(currentDay) === -1) {
          logger.debug(
            `Does not match schedule because ${currentDay} is not in ${scheduledDays}`
          );
          return false;
        }
      }
      // Check for start time
      if (schedule.t_a) {
        const startSeconds = schedule.t_a[0];
        if (currentSeconds < startSeconds) {
          logger.debug(
            `Does not match schedule because ${currentSeconds} is earlier than ${startSeconds}`
          );
          return false;
        }
      }
      // Check for end time
      if (schedule.t_b) {
        const endSeconds = schedule.t_b[0];
        if (currentSeconds > endSeconds) {
          logger.debug(
            `Does not match schedule because ${currentSeconds} is later than ${endSeconds}`
          );
          return false;
        }
      }
      logger.debug(`Matches schedule ${scheduleText}`);
      return true;
    });
  });
  if (!isWithinSchedule) {
    logger.debug('Package not scheduled');
    return false;
  }
  return true;
}
