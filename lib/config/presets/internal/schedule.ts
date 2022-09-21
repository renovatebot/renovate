import { gt } from '../../../i18n';
import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  earlyMondays: {
    description: gt.gettext('Weekly schedule on early Monday mornings.'),
    schedule: ['before 3am on Monday'],
  },
  daily: {
    description: gt.gettext('Schedule daily.'),
    schedule: ['before 2am'],
  },
  weekly: {
    description: gt.gettext('Schedule weekly.'),
    extends: ['schedule:earlyMondays'],
  },
  monthly: {
    description: gt.gettext('Schedule monthly.'),
    schedule: ['before 3am on the first day of the month'],
  },
  quarterly: {
    description: gt.gettext('Schedule quarterly.'),
    schedule: ['every 3 months on the first day of the month'],
  },
  yearly: {
    description: gt.gettext('Schedule once a year (not recommended).'),
    schedule: ['every 12 months on the first day of the month'],
  },
  weekends: {
    description: gt.gettext('Schedule for weekends.'),
    schedule: ['every weekend'],
  },
  weekdays: {
    description: gt.gettext('Schedule for weekdays.'),
    schedule: ['every weekday'],
  },
  nonOfficeHours: {
    description: gt.gettext(
      'Schedule for typical non-office hours (night time and weekends).'
    ),
    schedule: [
      'after 10pm every weekday',
      'before 5am every weekday',
      'every weekend',
    ],
  },
};
