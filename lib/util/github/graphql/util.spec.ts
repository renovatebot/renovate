import { DateTime } from 'luxon';
import { isDateExpired } from './util';

describe('util/github/graphql/util', () => {
  test.each`
    currentTime           | initialTimestamp      | duration        | expected
    ${'2022-11-25T15:58'} | ${'2022-11-25T15:00'} | ${{ hours: 1 }} | ${false}
    ${'2022-11-25T15:59'} | ${'2022-11-25T15:00'} | ${{ hours: 1 }} | ${false}
    ${'2022-11-25T16:00'} | ${'2022-11-25T15:00'} | ${{ hours: 1 }} | ${true}
    ${'2022-11-25T16:01'} | ${'2022-11-25T15:00'} | ${{ hours: 1 }} | ${true}
    ${'2022-11-25T14:58'} | ${'2022-11-24T15:00'} | ${{ days: 1 }}  | ${false}
    ${'2022-11-25T14:59'} | ${'2022-11-24T15:00'} | ${{ days: 1 }}  | ${false}
    ${'2022-11-25T15:00'} | ${'2022-11-24T15:00'} | ${{ days: 1 }}  | ${true}
    ${'2022-11-25T15:01'} | ${'2022-11-24T15:00'} | ${{ days: 1 }}  | ${true}
  `(
    'isDateExpired($currentTime, $initialTimestamp, $duration) === $expected',
    ({ currentTime, initialTimestamp, duration, expected }) => {
      expect(
        isDateExpired(DateTime.fromISO(currentTime), initialTimestamp, duration)
      ).toBe(expected);
    }
  );
});
