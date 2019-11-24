import is from '@sindresorhus/is';
import later from 'later';
import moment from 'moment-timezone';
import { logger } from '../../logger';

const scheduleMappings = {
  'every month': 'before 3am on the first day of the month',
  monthly: 'before 3am on the first day of the month',
};

function fixShortHours(input: string): string {
  return input.replace(/( \d?\d)((a|p)m)/g, '$1:00$2');
}

export function hasValidTimezone(
  timezone: string
): [boolean] | [boolean, string] {
  if (!moment.tz.zone(timezone)) {
    return [false, `Invalid timezone: ${timezone}`];
  }
  return [true];
}

export function hasValidSchedule(
  schedule: string[] | null | 'at any time'
): [boolean] | [boolean, string] {
  let message: string;
  if (
    !schedule ||
    schedule === 'at any time' ||
    schedule[0] === 'at any time'
  ) {
    return [true];
  }
  // check if any of the schedules fail to parse
  const hasFailedSchedules = schedule.some(scheduleText => {
    const massagedText = fixShortHours(
      scheduleMappings[scheduleText] || scheduleText
    );
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
        s => s.M || s.d !== undefined || s.D || s.t_a !== undefined || s.t_b
      )
    ) {
      message = `Schedule "${scheduleText}" has no months, days of week or time of day`;
      return true;
    }
    // It must be OK
    return false;
  });
  if (hasFailedSchedules) {
    // If any fail then we invalidate the whole thing
    return [false, message];
  }
  return [true, ''];
}

export function isScheduledNow(config): boolean {
  let configSchedule = config.schedule;
  logger.debug(`Checking schedule(${configSchedule}, ${config.timezone})`);
  if (
    !configSchedule ||
    configSchedule.length === 0 ||
    configSchedule[0] === '' ||
    configSchedule === 'at any time' ||
    configSchedule[0] === 'at any time'
  ) {
    logger.debug('No schedule defined');
    return true;
  }
  if (!is.array(configSchedule)) {
    logger.warn(
      `config schedule is not an array: ${JSON.stringify(configSchedule)}`
    );
    configSchedule = [configSchedule];
  }
  const [validSchedule, errorMessage] = hasValidSchedule(configSchedule);
  if (!validSchedule) {
    logger.warn(errorMessage);
    return true;
  }
  let now = moment();
  logger.trace(`now=${now.format()}`);
  // Adjust the time if repo is in a different timezone to renovate
  if (config.timezone) {
    logger.debug({ timezone: config.timezone }, 'Found timezone');
    const [validTimezone, error] = hasValidTimezone(config.timezone);
    if (!validTimezone) {
      logger.warn(error);
      return true;
    }
    logger.debug('Adjusting now for timezone');
    now = now.tz(config.timezone);
    logger.trace(`now=${now.format()}`);
  }
  // Get today in text form, e.g. "Monday";
  const currentDay = now.format('dddd');
  logger.trace(`currentDay=${currentDay}`);
  // Get the number of seconds since midnight
  const currentSeconds =
    now.hours() * 3600 + now.minutes() * 60 + now.seconds();
  logger.trace(`currentSeconds=${currentSeconds}`);
  // Support a single string but massage to array for processing
  logger.debug(`Checking ${configSchedule.length} schedule(s)`);
  // We run if any schedule matches
  const isWithinSchedule = configSchedule.some(scheduleText => {
    const massagedText = scheduleMappings[scheduleText] || scheduleText;
    const parsedSchedule = later.parse.text(fixShortHours(massagedText));
    logger.debug({ parsedSchedule }, `Checking schedule "${scheduleText}"`);
    // Later library returns array of schedules
    return parsedSchedule.schedules.some(schedule => {
      // Check if months are defined
      if (schedule.M) {
        const currentMonth = parseInt(now.format('M'), 10);
        if (!schedule.M.includes(currentMonth)) {
          logger.debug(
            `Does not match schedule because ${currentMonth} is not in ${schedule.M}`
          );
          return false;
        }
      }
      // Check if days are defined
      if (schedule.d) {
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
        logger.trace({ scheduledDays }, `scheduledDays`);
        if (!scheduledDays.includes(currentDay)) {
          logger.debug(
            `Does not match schedule because ${currentDay} is not in ${scheduledDays}`
          );
          return false;
        }
      }
      if (schedule.D) {
        logger.debug({ schedule_D: schedule.D }, `schedule.D`);
        // moment outputs as string but later outputs as integer
        const currentDayOfMonth = parseInt(now.format('D'), 10);
        if (!schedule.D.includes(currentDayOfMonth)) {
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
      // Check for week of year
      if (schedule.wy && !schedule.wy.includes(now.week())) {
        return false;
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
