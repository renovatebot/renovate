import { gettext } from '../../../i18n';
import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  earlyMondays: {
    description: gettext('Weekly schedule on early Monday mornings.'),
    schedule: ['before 3am on Monday'],
  },
  daily: {
    description: gettext('Schedule daily.'),
    schedule: ['before 2am'],
  },
  weekly: {
    description: gettext('Schedule weekly.'),
    extends: ['schedule:earlyMondays'],
  },
  monthly: {
    description: gettext('Schedule monthly.'),
    schedule: ['before 3am on the first day of the month'],
  },
  quarterly: {
    description: gettext('Schedule quarterly.'),
    schedule: ['every 3 months on the first day of the month'],
  },
  yearly: {
    description: gettext('Schedule once a year (not recommended).'),
    schedule: ['every 12 months on the first day of the month'],
  },
  weekends: {
    description: gettext('Schedule for weekends.'),
    schedule: ['every weekend'],
  },
  weekdays: {
    description: gettext('Schedule for weekdays.'),
    schedule: ['every weekday'],
  },
  nonOfficeHours: {
    description: gettext(
      'Schedule for typical non-office hours (night time and weekends).'
    ),
    schedule: [
      'after 10pm every weekday',
      'before 5am every weekday',
      'every weekend',
    ],
  },
};
