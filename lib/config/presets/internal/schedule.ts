import type { Preset } from '../types';

/* eslint sort-keys: ["error", "asc", {caseSensitive: false, natural: true}] */

export const presets: Record<string, Preset> = {
  daily: {
    description: 'Schedule daily.',
    schedule: ['before 2am'],
  },
  earlyMondays: {
    description: 'Weekly schedule on early Monday mornings.',
    schedule: ['before 3am on Monday'],
  },
  monthly: {
    description: 'Schedule monthly.',
    schedule: ['before 3am on the first day of the month'],
  },
  nonOfficeHours: {
    description:
      'Schedule for typical non-office hours (night time and weekends).',
    schedule: [
      'after 10pm every weekday',
      'before 5am every weekday',
      'every weekend',
    ],
  },
  quarterly: {
    description: 'Schedule quarterly.',
    schedule: ['every 3 months on the first day of the month'],
  },
  weekdays: {
    description: 'Schedule for weekdays.',
    schedule: ['every weekday'],
  },
  weekends: {
    description: 'Schedule for weekends.',
    schedule: ['every weekend'],
  },
  weekly: {
    description: 'Schedule weekly.',
    extends: ['schedule:earlyMondays'],
  },
  yearly: {
    description: 'Schedule once a year (not recommended).',
    schedule: ['every 12 months on the first day of the month'],
  },
};
