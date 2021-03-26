import type { Preset } from '../types';

export const presets: Record<string, Preset> = {
  earlyMondays: {
    description: 'Weekly schedule on early monday mornings',
    schedule: ['before 3am on Monday'],
  },
  daily: {
    description: 'Schedule daily',
    schedule: ['before 2am'],
  },
  weekly: {
    description: 'Schedule weekly',
    extends: ['schedule:earlyMondays'],
  },
  monthly: {
    description: 'Schedule monthly',
    schedule: ['before 3am on the first day of the month'],
  },
  quarterly: {
    description: 'Schedule quarterly',
    schedule: ['every 3 months on the first day of the month'],
  },
  yearly: {
    description: 'Schedule once a year (not recommended)',
    schedule: ['every 12 months on the first day of the month'],
  },
  weekends: {
    description: 'Schedule for weekends',
    schedule: ['every weekend'],
  },
  weekdays: {
    description: 'Schedule for weekdays',
    schedule: ['every weekday'],
  },
  nonOfficeHours: {
    description:
      'Schedule for typical non-office hours (night time and weekends)',
    schedule: [
      'after 10pm every weekday',
      'before 5am every weekday',
      'every weekend',
    ],
  },
};
