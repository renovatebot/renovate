import type { Response } from 'got';
import { hook, isResponseOk } from './hooks';

describe('util/http/hooks', () => {
  it.each`
    statusCode | followRedirect | expected
    ${200}     | ${false}       | ${true}
    ${299}     | ${false}       | ${true}
    ${304}     | ${false}       | ${true}
    ${304}     | ${true}        | ${true}
    ${400}     | ${false}       | ${false}
    ${400}     | ${true}        | ${false}
    ${302}     | ${true}        | ${false}
    ${302}     | ${false}       | ${true}
  `(
    `returns $expected for status code $statusCode and followRedirect $followRedirect`,
    ({ statusCode, followRedirect, expected }) => {
      const destroy = jest.fn();
      const response = {
        statusCode,
        request: {
          options: { followRedirect },
          destroy,
        },
      } as never as Response;

      expect(isResponseOk(response)).toBe(expected);

      hook(response);
      const calledTimes = expected ? 1 : 0;
      expect(destroy).toHaveBeenCalledTimes(calledTimes);
    },
  );
});
