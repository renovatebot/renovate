import type { Preset } from '../types';

/* eslint sort-keys: ["error", "asc", {caseSensitive: false, natural: true}] */

const daily = ['* 0-3 * * *'];
const earlyMondays = ['* 0-3 * * 1'];
const monthly = ['* 0-3 1 * *'];
const nonOfficeHours = ['* 0-4,22-23 * * 1-5', '* * * * 6,7'];
const quarterly = ['* * * */3 *'];
const weekdays = ['* * * * 1-5'];
const weekends = ['* * * * 6,7'];
const yearly = ['* * 1 */12 *'];

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
