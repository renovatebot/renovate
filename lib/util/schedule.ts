import { CronPattern } from 'croner';
import cronstrue from 'cronstrue';
import { capitalize } from './string.ts';

/**
 * Return human-readable cron schedule summary if the schedule is a valid cron
 * else return null
 */
export function getReadableCronSchedule(
  scheduleText: string[],
): string[] | null {
  // assuming if one schedule is cron the others in the array will be cron too
  try {
    new CronPattern(scheduleText[0]); // validate cron
    return scheduleText.map(
      (cron) =>
        capitalize(
          cronstrue
            .toString(cron, {
              throwExceptionOnParseError: false,
            })
            .replace('Every minute, ', ''),
        ) + ` (\`${cron}\`)`,
    );
  } catch {
    return null;
  }
}
