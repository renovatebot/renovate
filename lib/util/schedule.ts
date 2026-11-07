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
  try {
    return scheduleText.map((cron) => {
      new CronPattern(cron);
      const description = cronstrue
        .toString(cron, { throwExceptionOnParseError: false })
        .replace('Every minute, ', '');
      return `${capitalize(description)} (\`${cron}\`)`;
    });
  } catch {
    return null;
  }
}
