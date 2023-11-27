import later from '@breejs/later';
import is from '@sindresorhus/is';
import {
  CronExpression,
  DayOfTheMonthRange,
  DayOfTheWeekRange,
  HourRange,
  MonthRange,
  parseExpression,
} from 'cron-parser';
import { DateTime } from 'luxon';
import { fixShortHours } from '../../../../config/migration';
import type { RenovateConfig } from '../../../../config/types';
import { logger } from '../../../../logger';

const minutesChar = '*';

const scheduleMappings: Record<string, string> = {
  'every month': 'before 5am on the first day of the month',
  monthly: 'before 5am on the first day of the month',
};

function parseCron(
  scheduleText: string,
  timezone?: string,
): CronExpression | undefined {
  try {
    return parseExpression(scheduleText, { tz: timezone });
  } catch (err) {
    return undefined;
  }
}

export function hasValidTimezone(timezone: string): [true] | [false, string] {
  if (!DateTime.local().setZone(timezone).isValid) {
    return [false, `Invalid schedule: Unsupported timezone ${timezone}`];
  }
  return [true];
}

export function hasValidSchedule(
  schedule: string[] | null | 'at any time',
): [true] | [false, string] {
  let message = '';
  if (
    !schedule ||
    schedule === 'at any time' ||
    schedule[0] === 'at any time'
  ) {
    return [true];
  }
  // check if any of the schedules fail to parse
  const hasFailedSchedules = schedule.some((scheduleText) => {
    const parsedCron = parseCron(scheduleText);
    if (parsedCron !== undefined) {
      if (
        parsedCron.fields.minute.length !== 60 ||
        scheduleText.indexOf(minutesChar) !== 0
      ) {
        message = `Invalid schedule: "${scheduleText}" has cron syntax, but doesn't have * as minutes`;
        return true;
      }

      // It was valid cron syntax and * as minutes
      return false;
    }

    const massagedText = fixShortHours(
      scheduleMappings[scheduleText] || scheduleText,
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
        (s) =>
          !!s.M || s.d !== undefined || !!s.D || s.t_a !== undefined || !!s.t_b,
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
  return [true];
}

function cronMatches(cron: string, now: DateTime, timezone?: string): boolean {
  const parsedCron = parseCron(cron, timezone);

  // it will always parse because it is checked beforehand
  // istanbul ignore if
  if (!parsedCron) {
    return false;
  }

  if (parsedCron.fields.hour.indexOf(now.hour as HourRange) === -1) {
    // Hours mismatch
    return false;
  }

  if (
    parsedCron.fields.dayOfMonth.indexOf(now.day as DayOfTheMonthRange) === -1
  ) {
    // Days mismatch
    return false;
  }

  if (
    !parsedCron.fields.dayOfWeek.includes(
      (now.weekday % 7) as DayOfTheWeekRange,
    )
  ) {
    // Weekdays mismatch
    return false;
  }

  if (parsedCron.fields.month.indexOf(now.month as MonthRange) === -1) {
    // Months mismatch
    return false;
  }

  // Match
  return true;
}

export function isScheduledNow(
  config: RenovateConfig,
  scheduleKey: 'schedule' | 'automergeSchedule' = 'schedule',
): boolean {
  let configSchedule = config[scheduleKey];
  logger.debug(
    // TODO: types (#22198)
    `Checking schedule(${String(configSchedule)}, ${config.timezone!})`,
  );
  if (
    !configSchedule ||
    configSchedule.length === 0 ||
    configSchedule[0] === '' ||
    configSchedule[0] === 'at any time'
  ) {
    logger.debug('No schedule defined');
    return true;
  }
  if (!is.array(configSchedule)) {
    logger.warn(
      `config schedule is not an array: ${JSON.stringify(configSchedule)}`,
    );
    configSchedule = [configSchedule];
  }
  const validSchedule = hasValidSchedule(configSchedule);
  if (!validSchedule[0]) {
    logger.warn(validSchedule[1]);
    return true;
  }
  let now = DateTime.local();
  logger.trace(`now=${now.toISO()!}`);
  // Adjust the time if repo is in a different timezone to renovate
  if (config.timezone) {
    logger.debug(`Found timezone: ${config.timezone}`);
    const validTimezone = hasValidTimezone(config.timezone);
    if (!validTimezone[0]) {
      logger.warn(validTimezone[1]);
      return true;
    }
    logger.debug('Adjusting now for timezone');
    now = now.setZone(config.timezone);
    logger.trace(`now=${now.toISO()!}`);
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

  // later is timezone agnostic (as in, it purely relies on the underlying UTC date/time that is stored in the Date),
  // which means we have to pass it a Date that has an underlying UTC date/time in the same timezone as the schedule
  const jsNow = now.setZone('utc', { keepLocalTime: true }).toJSDate();

  // We run if any schedule matches
  const isWithinSchedule = configSchedule.some((scheduleText) => {
    const cronSchedule = parseCron(scheduleText);
    if (cronSchedule) {
      // We have Cron syntax
      if (cronMatches(scheduleText, now, config.timezone)) {
        logger.debug(`Matches schedule ${scheduleText}`);
        return true;
      }
    } else {
      // We have Later syntax
      const massagedText = scheduleMappings[scheduleText] || scheduleText;
      const parsedSchedule = later.parse.text(fixShortHours(massagedText));
      logger.debug({ parsedSchedule }, `Checking schedule "${scheduleText}"`);

      if (later.schedule(parsedSchedule).isValid(jsNow)) {
        logger.debug(`Matches schedule ${scheduleText}`);
        return true;
      }
    }

    return false;
  });
  if (!isWithinSchedule) {
    logger.debug('Package not scheduled');
    return false;
  }
  return true;
}
