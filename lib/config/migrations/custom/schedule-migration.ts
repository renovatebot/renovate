import later from '@breejs/later';
import is from '@sindresorhus/is';
import { regEx } from '../../../util/regex';
import { AbstractMigration } from '../base/abstract-migration';

export class ScheduleMigration extends AbstractMigration {
  override readonly propertyName = 'schedule';

  override run(value: unknown): void {
    if (value) {
      // massage to array first
      let schedules: string[] = [];
      if (is.string(value)) {
        schedules = [value];
      }
      if (Array.isArray(value)) {
        schedules = [...value];
      }
      // split 'and'
      const schedulesLength = schedules.length;
      for (let i = 0; i < schedulesLength; i += 1) {
        if (
          schedules[i].includes(' and ') &&
          schedules[i].includes('before ') &&
          schedules[i].includes('after ')
        ) {
          const parsedSchedule = later.parse.text(
            // We need to massage short hours first before we can parse it
            schedules[i].replace(regEx(/( \d?\d)((a|p)m)/g), '$1:00$2') // TODO #12071
          ).schedules[0];
          // Only migrate if the after time is greater than before, e.g. "after 10pm and before 5am"
          if (!parsedSchedule?.t_a || !parsedSchedule.t_b) {
            continue;
          }

          if (parsedSchedule.t_a[0] > parsedSchedule.t_b[0]) {
            const toSplit = schedules[i];
            schedules[i] = toSplit
              .replace(
                regEx(
                  /^(.*?)(after|before) (.*?) and (after|before) (.*?)( |$)(.*)/
                ), // TODO #12071
                '$1$2 $3 $7'
              )
              .trim();
            schedules.push(
              toSplit
                .replace(
                  regEx(
                    /^(.*?)(after|before) (.*?) and (after|before) (.*?)( |$)(.*)/
                  ), // TODO #12071
                  '$1$4 $5 $7'
                )
                .trim()
            );
          }
        }
      }
      for (let i = 0; i < schedules.length; i += 1) {
        if (schedules[i].includes('on the last day of the month')) {
          schedules[i] = schedules[i].replace(
            'on the last day of the month',
            'on the first day of the month'
          );
        }
        if (schedules[i].includes('on every weekday')) {
          schedules[i] = schedules[i].replace(
            'on every weekday',
            'every weekday'
          );
        }
        if (schedules[i].endsWith(' every day')) {
          schedules[i] = schedules[i].replace(' every day', '');
        }
        if (
          regEx(/every (mon|tues|wednes|thurs|fri|satur|sun)day$/).test(
            schedules[i]
          ) // TODO #12071
        ) {
          schedules[i] = schedules[i].replace(
            regEx(/every ([a-z]*day)$/), // TODO #12071
            'on $1'
          );
        }
        if (schedules[i].endsWith('days')) {
          schedules[i] = schedules[i].replace('days', 'day');
        }
      }
      if (is.string(value) && schedules.length === 1) {
        this.rewrite(schedules[0]);
      } else {
        this.rewrite(schedules);
      }
    }
  }
}
