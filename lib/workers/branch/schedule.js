const later = require('later');
const moment = require('moment-timezone');

module.exports = {
  hasValidSchedule,
  isScheduledNow,
};

function fixShortHours(input) {
  return input.replace(/( \d?\d)((a|p)m)/g, '$1:00$2');
}

function hasValidSchedule(schedule) {
  if (!Array.isArray(schedule)) {
    return [false, 'Invalid schedule'];
  }
  let message;
  // check if any of the schedules fail to parse
  const hasFailedSchedules = schedule.some(scheduleText => {
    const parsedSchedule = later.parse.text(fixShortHours(scheduleText));
    if (parsedSchedule.error !== -1) {
      message = `Failed to parse schedule ${scheduleText}`;
      // It failed to parse
      return true;
    }
    if (parsedSchedule.schedules.some(s => s.m)) {
      message = 'Schedules should not specify minutes';
      return true;
    }
    if (!parsedSchedule.schedules.some(s => s.d || s.t_a || s.t_b)) {
      message = 'Schedule has no days of week or time of day';
      return true;
    }
    // It must be OK
    return false;
  });
  if (hasFailedSchedules) {
    // If any fail then we invalidate the whole thing
    return [false, message];
  }
  return [true];
}

function isScheduledNow(config) {
  config.logger.debug({ schedule: config.schedule }, `Checking schedule`);
  if (
    !config.schedule ||
    config.schedule.length === 0 ||
    config.schedule[0] === ''
  ) {
    config.logger.debug('No schedule defined');
    return true;
  }
  const [validSchedule, errorMessage] = hasValidSchedule(config.schedule);
  if (!validSchedule) {
    config.logger.error(errorMessage);
    return true;
  }
  let now = moment();
  config.logger.debug(`now=${now.format()}`);
  // Adjust the time if repo is in a different timezone to renovate
  if (config.timezone) {
    // TODO: check for validity manually
    now = now.tz(config.timezone);
    config.logger.debug(`now=${now.format()}`);
  }
  // Get today in text form, e.g. "Monday";
  const currentDay = now.format('dddd');
  config.logger.debug(`currentDay=${currentDay}`);
  // Get the number of seconds since midnight
  const currentSeconds =
    now.hours() * 3600 + now.minutes() * 60 + now.seconds();
  config.logger.debug(`currentSeconds=${currentSeconds}`);
  // Support a single string but massage to array for processing
  config.logger.debug(`Checking ${config.schedule.length} schedule(s)`);
  // We run if any schedule matches
  const isWithinSchedule = config.schedule.some(scheduleText => {
    config.logger.debug(`Checking schedule "${scheduleText}"`);
    const parsedSchedule = later.parse.text(fixShortHours(scheduleText));
    // Later library returns array of schedules
    return parsedSchedule.schedules.some(schedule => {
      // Check if days are defined
      if (schedule.d) {
        config.logger.debug({ schedule_d: schedule.d }, `schedule.d`);
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
        config.logger.debug({ scheduledDays }, `scheduledDays`);
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
