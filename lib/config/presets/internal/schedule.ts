import type { Preset } from '../types';

/* eslint sort-keys: ["error", "asc", {caseSensitive: false, natural: true}] */

export const presets: Record<string, Preset> = {
  automergeDaily: {
    automergeSchedule: ['before 2am'],
    description: 'Schedule automerge daily.',
  },
  automergeEarlyMondays: {
    automergeSchedule: ['before 3am on Monday'],
    description: 'Weekly automerge schedule on early Monday mornings.',
  },
  automergeMonthly: {
    automergeSchedule: ['before 3am on the first day of the month'],
    description: 'Schedule automerge monthly.',
  },
  automergeNonOfficeHours: {
    automergeSchedule: [
      'after 10pm every weekday',
      'before 5am every weekday',
      'every weekend',
    ],
    description:
      'Schedule automerge for typical non-office hours (night time and weekends).',
  },
  automergeQuarterly: {
    automergeSchedule: ['every 3 months on the first day of the month'],
    description: 'Schedule automerge quarterly.',
  },
  automergeWeekdays: {
    automergeSchedule: ['every weekday'],
    description: 'Schedule automerge for weekdays.',
  },
  automergeWeekends: {
    automergeSchedule: ['every weekend'],
    description: 'Schedule automerge for weekends.',
  },
  automergeWeekly: {
    description: 'Schedule automerge weekly.',
    extends: ['schedule:automergeEarlyMondays'],
  },
  automergeYearly: {
    automergeSchedule: ['every 12 months on the first day of the month'],
    description: 'Schedule automerge once a year (not recommended).',
  },
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
