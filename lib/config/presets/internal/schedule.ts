import type { Preset } from '../types';

/* eslint sort-keys: ["error", "asc", {caseSensitive: false, natural: true}] */

const daily = ['before 4am'];
const earlyMondays = ['before 4am on Monday'];
const monthly = ['before 4am on the first day of the month'];
const nonOfficeHours = [
  'after 10pm every weekday',
  'before 5am every weekday',
  'every weekend',
];
const quarterly = ['every 3 months on the first day of the month'];
const weekdays = ['every weekday'];
const weekends = ['every weekend'];
const yearly = ['every 12 months on the first day of the month'];

export const presets: Record<string, Preset> = {
  automergeDaily: {
    automergeSchedule: daily,
    description: 'Schedule automerge daily.',
  },
  automergeEarlyMondays: {
    automergeSchedule: earlyMondays,
    description: 'Weekly automerge schedule on early Monday mornings.',
  },
  automergeMonthly: {
    automergeSchedule: monthly,
    description: 'Schedule automerge monthly.',
  },
  automergeNonOfficeHours: {
    automergeSchedule: nonOfficeHours,
    description:
      'Schedule automerge for typical non-office hours (night time and weekends).',
  },
  automergeQuarterly: {
    automergeSchedule: quarterly,
    description: 'Schedule automerge quarterly.',
  },
  automergeWeekdays: {
    automergeSchedule: weekdays,
    description: 'Schedule automerge for weekdays.',
  },
  automergeWeekends: {
    automergeSchedule: weekends,
    description: 'Schedule automerge for weekends.',
  },
  automergeWeekly: {
    description: 'Schedule automerge weekly.',
    extends: ['schedule:automergeEarlyMondays'],
  },
  automergeYearly: {
    automergeSchedule: yearly,
    description: 'Schedule automerge once a year (not recommended).',
  },
  daily: {
    description: 'Schedule daily.',
    schedule: daily,
  },
  earlyMondays: {
    description: 'Weekly schedule on early Monday mornings.',
    schedule: earlyMondays,
  },
  monthly: {
    description: 'Schedule monthly.',
    schedule: monthly,
  },
  nonOfficeHours: {
    description:
      'Schedule for typical non-office hours (night time and weekends).',
    schedule: nonOfficeHours,
  },
  quarterly: {
    description: 'Schedule quarterly.',
    schedule: quarterly,
  },
  weekdays: {
    description: 'Schedule for weekdays.',
    schedule: weekdays,
  },
  weekends: {
    description: 'Schedule for weekends.',
    schedule: weekends,
  },
  weekly: {
    description: 'Schedule weekly.',
    extends: ['schedule:earlyMondays'],
  },
  yearly: {
    description: 'Schedule once a year (not recommended).',
    schedule: yearly,
  },
};
