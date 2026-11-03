import {
  isBadGateway,
  isBadRequest,
  isClientError,
  isConflict,
  isForbidden,
  isGone,
  isMethodNotAllowed,
  isMultipleChoices,
  isNoContent,
  isNotAcceptable,
  isNotFound,
  isNotModified,
  isOk,
  isRateLimited,
  isRateLimitedOrServerError,
  isServerError,
  isServiceUnavailable,
  isUnauthorized,
  isUnprocessableContent,
} from './status.ts';

describe('util/http/status', () => {
  it.each`
    predicate                 | statusCode
    ${isOk}                   | ${200}
    ${isNoContent}            | ${204}
    ${isMultipleChoices}      | ${300}
    ${isNotModified}          | ${304}
    ${isBadRequest}           | ${400}
    ${isUnauthorized}         | ${401}
    ${isForbidden}            | ${403}
    ${isNotFound}             | ${404}
    ${isMethodNotAllowed}     | ${405}
    ${isNotAcceptable}        | ${406}
    ${isConflict}             | ${409}
    ${isGone}                 | ${410}
    ${isUnprocessableContent} | ${422}
    ${isRateLimited}          | ${429}
    ${isBadGateway}           | ${502}
    ${isServiceUnavailable}   | ${503}
  `('$predicate.name matches only $statusCode', ({ predicate, statusCode }) => {
    expect(predicate(statusCode)).toBeTrue();
    expect(predicate(statusCode + 1)).toBeFalse();
    expect(predicate(undefined)).toBeFalse();
  });

  it.each`
    statusCode   | clientError | serverError | rateLimitedOrServerError
    ${undefined} | ${false}    | ${false}    | ${false}
    ${399}       | ${false}    | ${false}    | ${false}
    ${400}       | ${true}     | ${false}    | ${false}
    ${429}       | ${true}     | ${false}    | ${true}
    ${499}       | ${true}     | ${false}    | ${false}
    ${500}       | ${false}    | ${true}     | ${true}
    ${599}       | ${false}    | ${true}     | ${true}
    ${600}       | ${false}    | ${false}    | ${false}
  `(
    'classifies $statusCode',
    ({ statusCode, clientError, serverError, rateLimitedOrServerError }) => {
      expect(isClientError(statusCode)).toBe(clientError);
      expect(isServerError(statusCode)).toBe(serverError);
      expect(isRateLimitedOrServerError(statusCode)).toBe(
        rateLimitedOrServerError,
      );
    },
  );
});
