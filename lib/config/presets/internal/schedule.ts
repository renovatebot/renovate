import type { Preset } from '../types';

/* eslint sort-keys: ["error", "asc", {caseSensitive: false, natural: true}] */

const daily = ['* 0-3 * * *'];
const earlyMondays = ['* 0-3 * * 1'];
const monthly = ['* 0-3 1 * *'];
const nonOfficeHours = ['* 0-4,22-23 * * 1-5', '* * * * 0,6'];
const officeHours = ['* 8-17 * * 1-5'];
const quarterly = ['* * 1 */3 *'];
const weekdays = ['* * * * 1-5'];
const weekends = ['* * * * 0,6'];
const yearly = ['* * 1 */12 *'];

export const presets: Record<string, Preset> = {
  automergeDaily: {
    automergeSchedule: daily,
    description: 'Schedule automerge daily before 4 AM.',
  },
  automergeEarlyMondays: {
    automergeSchedule: earlyMondays,
    description: 'Schedule automerge on Monday mornings (before 4 AM).',
  },
  automergeMonthly: {
    automergeSchedule: monthly,
    description:
      'Schedule automerge for the first day of each month, before 4 AM.',
  },
  automergeNonOfficeHours: {
    automergeSchedule: nonOfficeHours,
    description:
      'Schedule automerge during typical non-office hours on weekdays (i.e., 10 PM - 5 AM) and anytime on weekends.',
  },
  automergeOfficeHours: {
    automergeSchedule: officeHours,
    description:
      'Schedule automerge during typical office hours on weekdays (i.e., 8 AM - 6 PM).',
  },
  automergeQuarterly: {
    automergeSchedule: quarterly,
    description:
      'Schedule automerge on the first day of each quarter (i.e., January, April, July, October).',
  },
  automergeWeekdays: {
    automergeSchedule: weekdays,
    description: 'Schedule automerge anytime on weekdays.',
  },
  automergeWeekends: {
    automergeSchedule: weekends,
    description: 'Schedule automerge anytime on weekends.',
  },
  automergeWeekly: {
    description: 'Schedule automerge weekly.',
    extends: ['schedule:automergeEarlyMondays'],
  },
  automergeYearly: {
    automergeSchedule: yearly,
    description:
      'Schedule automerge once a year on the first day of January (not recommended).',
  },
  daily: {
    description: 'Schedule daily before 4 AM.',
    schedule: daily,
  },
  earlyMondays: {
    description: 'Weekly schedule on early Monday mornings (before 4 AM).',
    schedule: earlyMondays,
  },
  monthly: {
    description:
      'Schedule once a month on the first day of the month before 4 AM.',
    schedule: monthly,
  },
  nonOfficeHours: {
    description:
      'Schedule during typical non-office hours on weekdays (i.e., 10 PM - 5 AM) and anytime on weekends.',
    schedule: nonOfficeHours,
  },
  officeHours: {
    description:
      'Schedule during typical office hours on weekdays (i.e., 8 AM - 6 PM).',
    schedule: officeHours,
  },
  quarterly: {
    description:
      'Schedule on the first day of each quarter (i.e., January, April, July, October).',
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
    description:
      'Schedule once a year on the first day of January (not recommended).',
    schedule: yearly,
  },
};
