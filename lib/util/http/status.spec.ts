import { RequestError } from 'got';
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
  isRangeNotSatisfiable,
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
    ${isRangeNotSatisfiable}  | ${416}
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

  describe('status sources', () => {
    function httpError(statusCode?: number): RequestError {
      const err = new RequestError('request error', {}, null as never);
      if (statusCode) {
        Object.assign(err, { response: { statusCode } });
      }
      return err;
    }

    it.each`
      name                           | source                 | notFound | serverError
      ${'a status code'}             | ${404}                 | ${true}  | ${false}
      ${'a response'}                | ${{ statusCode: 404 }} | ${true}  | ${false}
      ${'a response without status'} | ${{}}                  | ${false} | ${false}
      ${'a server error response'}   | ${{ statusCode: 503 }} | ${false} | ${true}
      ${'an error with a response'}  | ${httpError(404)}      | ${true}  | ${false}
      ${'an error with a 5xx'}       | ${httpError(500)}      | ${false} | ${true}
      ${'an error without response'} | ${httpError()}         | ${false} | ${false}
      ${'nothing'}                   | ${undefined}           | ${false} | ${false}
      ${'null'}                      | ${null}                | ${false} | ${false}
      ${'a thrown string'}           | ${'error'}             | ${false} | ${false}
    `('reads the status of $name', ({ source, notFound, serverError }) => {
      expect(isNotFound(source)).toBe(notFound);
      expect(isServerError(source)).toBe(serverError);
    });
  });
});
