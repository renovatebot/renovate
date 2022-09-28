import { z } from 'zod';
import { logger } from '../../test/util';
import * as memCache from './cache/memory';
import * as schema from './schema';

describe('util/schema', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    memCache.init();
  });

  it('validates data', () => {
    const testSchema = z.object({ foo: z.string() });
    const validData = { foo: 'bar' };

    const res = schema.match(testSchema, validData);
    expect(res).toBeTrue();
  });

  it('returns false for invalid data', () => {
    const testSchema = z.object({ foo: z.string() });
    const invalidData = { foo: 123 };

    const res = schema.match(testSchema, invalidData);
    expect(res).toBeFalse();

    schema.reportErrors();
    expect(logger.logger.warn).not.toHaveBeenCalled();
  });

  it('reports nothing if there are no any reports', () => {
    schema.reportErrors();
    expect(logger.logger.warn).not.toHaveBeenCalled();
  });

  it('reports same warning one time', () => {
    const testSchema = z.object(
      { foo: z.string() },
      { description: 'Some test schema' }
    );
    const invalidData = { foo: 42 };

    schema.match(testSchema, invalidData, true);
    schema.match(testSchema, invalidData, true);
    schema.match(testSchema, invalidData, true);
    schema.match(testSchema, invalidData, true);
    schema.reportErrors();

    expect(logger.logger.warn).toHaveBeenCalledOnce();
    expect(logger.logger.warn.mock.calls[0]).toMatchObject([
      { description: 'Some test schema' },
      'Schema validation error',
    ]);
  });

  it('reports unspecified schema', () => {
    const testSchema = z.object({ foo: z.string() });
    const invalidData = { foo: 42 };

    schema.match(testSchema, invalidData, true);
    schema.reportErrors();

    expect(logger.logger.warn).toHaveBeenCalledOnce();
    expect(logger.logger.warn.mock.calls[0]).toMatchObject([
      { description: 'Unspecified schema' },
      'Schema validation error',
    ]);
  });
});
