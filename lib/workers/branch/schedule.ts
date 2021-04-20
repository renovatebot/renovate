import later from '@breejs/later';
import is from '@sindresorhus/is';
import { DateTime } from 'luxon';
import type { RenovateConfig } from '../../config/types';
import { logger } from '../../logger';

const scheduleMappings: Record<string, string> = {
  'every month': 'before 3am on the first day of the month',
  monthly: 'before 3am on the first day of the month',
};

function fixShortHours(input: string): string {
  return input.replace(/( \d?\d)((a|p)m)/g, '$1:00$2');
}

export function hasValidTimezone(
  timezone: string
): [boolean] | [boolean, string] {
  if (!DateTime.local().setZone(timezone).isValid) {
    return [false, `Invalid schedule: Unsupported timezone ${timezone}`];
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
  const hasFailedSchedules = schedule.some((scheduleText) => {
    const massagedText = fixShortHours(
      scheduleMappings[scheduleText] || scheduleText
    );
    const parsedSchedule = later.parse.text(massagedText);
    if (parsedSchedule.error !== -1) {
      message = `Invalid schedule: Failed to parse "${scheduleText}"`;
      // It failed to parse
      return true;
    }
    if (parsedSchedule.schedules.some((s) => s.m)) {
      message = `Invalid schedule: "${scheduleText}" should not specify minutes`;
      return true;
    }
    if (
      !parsedSchedule.schedules.some(
        (s) => s.M || s.d !== undefined || s.D || s.t_a !== undefined || s.t_b
      )
    ) {
      message = `Invalid schedule: "${scheduleText}" has no months, days of week or time of day`;
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

export function isScheduledNow(config: RenovateConfig): boolean {
  let configSchedule = config.schedule;
  logger.debug(
    `Checking schedule(${String(configSchedule)}, ${config.timezone})`
  );
  if (
    !configSchedule ||
    configSchedule.length === 0 ||
    configSchedule[0] === '' ||
    configSchedule === ('at any time' as never) ||
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
  let now = DateTime.local();
  logger.trace(`now=${now.toISO()}`);
  // Adjust the time if repo is in a different timezone to renovate
  if (config.timezone) {
    logger.debug({ timezone: config.timezone }, 'Found timezone');
    const [validTimezone, error] = hasValidTimezone(config.timezone);
    if (!validTimezone) {
      logger.warn(error);
      return true;
    }
    logger.debug('Adjusting now for timezone');
    now = now.setZone(config.timezone);
    logger.trace(`now=${now.toISO()}`);
  }
  const currentDay = now.weekday;
  logger.trace(`currentDay=${currentDay}`);
  // Get the number of seconds since midnight
  const currentSeconds = now
    .startOf('second')
    .diff(now.startOf('day'), 'seconds').seconds;
  logger.trace(`currentSeconds=${currentSeconds}`);
  // Support a single string but massage to array for processing
  logger.debug(`Checking ${configSchedule.length} schedule(s)`);
  // We run if any schedule matches
  const isWithinSchedule = configSchedule.some((scheduleText) => {
    const massagedText = scheduleMappings[scheduleText] || scheduleText;
    const parsedSchedule = later.parse.text(fixShortHours(massagedText));
    logger.debug({ parsedSchedule }, `Checking schedule "${scheduleText}"`);
    // Later library returns array of schedules
    return parsedSchedule.schedules.some((schedule) => {
      // Check if months are defined
      if (schedule.M) {
        const currentMonth = now.month;
        if (!schedule.M.includes(currentMonth)) {
          logger.debug(
            `Does not match schedule because ${currentMonth} is not in ${String(
              schedule.M
            )}`
          );
          return false;
        }
      }
      // Check if days are defined
      if (schedule.d) {
        // We need to map because 'luxon' uses monday as first day
        // and later uses sundays as first day of week
        // http://bunkat.github.io/later/time-periods.html#day-of-week
        const dowMap = [6, 7, 1, 2, 3, 4, 5, 6];
        const scheduledDays = schedule.d.map((day) => dowMap[day]);
        logger.trace({ scheduledDays }, `scheduledDays`);
        if (!scheduledDays.includes(currentDay)) {
          logger.debug(
            `Does not match schedule because ${currentDay} is not in ${String(
              scheduledDays
            )}`
          );
          return false;
        }
      }
      if (schedule.D) {
        logger.debug({ schedule_D: schedule.D }, `schedule.D`);
        const currentDayOfMonth = now.day;
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
      if (schedule.wy && !schedule.wy.includes(now.weekNumber)) {
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
