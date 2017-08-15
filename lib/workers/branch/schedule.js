const later = require('later');
const moment = require('moment-timezone');

module.exports = {
  hasValidSchedule,
  isScheduledNow,
};

function fixShortHours(input) {
  return input.replace(/( \d?\d)((a|p)m)/g, '$1:00$2');
}
function fixOnEvery(input) {
  return input.replace(' on every ', ' every ');
}
function massageSchedule(input) {
  const output = fixShortHours(input);
  return fixOnEvery(output);
}

function hasValidSchedule(schedule) {
  let message;
  // check if any of the schedules fail to parse
  const hasFailedSchedules = schedule.some(scheduleText => {
    const massagedText = massageSchedule(scheduleText);
    const parsedSchedule = later.parse.text(massagedText);
    if (parsedSchedule.error !== -1) {
      message = `Failed to parse schedule "${scheduleText}"`;
      // It failed to parse
      return true;
    }
    if (parsedSchedule.schedules.some(s => s.m)) {
      message = `Schedule "${scheduleText}" should not specify minutes`;
      return true;
    }
    if (
      !parsedSchedule.schedules.some(
        s => s.d !== undefined || s.D || s.t_a !== undefined || s.t_b
      )
    ) {
      message = `Schedule "${scheduleText}" has no days of week or time of day`;
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
  let configSchedule = config.schedule;
  config.logger.debug({ schedule: configSchedule }, `Checking schedule`);
  if (
    !configSchedule ||
    configSchedule.length === 0 ||
    configSchedule[0] === ''
  ) {
    config.logger.debug('No schedule defined');
    return true;
  }
  if (!Array.isArray(configSchedule)) {
    config.logger.warn(
      `config schedule is not an array: ${JSON.stringify(configSchedule)}`
    );
    configSchedule = [configSchedule];
  }
  const [validSchedule, errorMessage] = hasValidSchedule(configSchedule);
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
  config.logger.debug(`Checking ${configSchedule.length} schedule(s)`);
  // We run if any schedule matches
  const isWithinSchedule = configSchedule.some(scheduleText => {
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
