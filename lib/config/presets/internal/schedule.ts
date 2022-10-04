import { _ } from '../../../i18n';
import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  earlyMondays: {
    description: _('Weekly schedule on early Monday mornings.'),
    schedule: ['before 3am on Monday'],
  },
  daily: {
    description: _('Schedule daily.'),
    schedule: ['before 2am'],
  },
  weekly: {
    description: _('Schedule weekly.'),
    extends: ['schedule:earlyMondays'],
  },
  monthly: {
    description: _('Schedule monthly.'),
    schedule: ['before 3am on the first day of the month'],
  },
  quarterly: {
    description: _('Schedule quarterly.'),
    schedule: ['every 3 months on the first day of the month'],
  },
  yearly: {
    description: _('Schedule once a year (not recommended).'),
    schedule: ['every 12 months on the first day of the month'],
  },
  weekends: {
    description: _('Schedule for weekends.'),
    schedule: ['every weekend'],
  },
  weekdays: {
    description: _('Schedule for weekdays.'),
    schedule: ['every weekday'],
  },
  nonOfficeHours: {
    description: _(
      'Schedule for typical non-office hours (night time and weekends).'
    ),
    schedule: [
      'after 10pm every weekday',
      'before 5am every weekday',
      'every weekend',
    ],
  },
};
