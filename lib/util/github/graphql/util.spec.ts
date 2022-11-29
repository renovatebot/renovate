import { DateTime } from 'luxon';
import { isDateExpired } from './util';

const isoTs = (t: string) => DateTime.fromJSDate(new Date(t)).toISO();

describe('util/github/graphql/util', () => {
  test.each`
    currentTime           | initialTimestamp      | duration        | expected
    ${'2022-11-25 15:58'} | ${'2022-11-25 15:00'} | ${{ hours: 1 }} | ${false}
    ${'2022-11-25 15:59'} | ${'2022-11-25 15:00'} | ${{ hours: 1 }} | ${false}
    ${'2022-11-25 16:00'} | ${'2022-11-25 15:00'} | ${{ hours: 1 }} | ${true}
    ${'2022-11-25 16:01'} | ${'2022-11-25 15:00'} | ${{ hours: 1 }} | ${true}
    ${'2022-11-25 14:58'} | ${'2022-11-24 15:00'} | ${{ days: 1 }}  | ${false}
    ${'2022-11-25 14:59'} | ${'2022-11-24 15:00'} | ${{ days: 1 }}  | ${false}
    ${'2022-11-25 15:00'} | ${'2022-11-24 15:00'} | ${{ days: 1 }}  | ${true}
    ${'2022-11-25 15:01'} | ${'2022-11-24 15:00'} | ${{ days: 1 }}  | ${true}
  `(
    'isDateExpired($currentTime, $initialTimestamp, $duration) === $expected',
    ({ currentTime, initialTimestamp, duration, expected }) => {
      expect(
        isDateExpired(
          DateTime.fromISO(isoTs(currentTime)),
          isoTs(initialTimestamp),
          duration
        )
      ).toBe(expected);
    }
  );
});
