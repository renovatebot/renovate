import { z } from 'zod';
import { logger } from '../../test/util';
import * as memCache from './cache/memory';
import { checkSchema, reportErrors } from './schema';

describe('util/schema', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    memCache.init();
  });

  it('validates data', () => {
    const schema = z.object({ foo: z.string() });
    const validData = { foo: 'bar' };

    const res = checkSchema(schema, validData);
    expect(res).toBeTrue();

    reportErrors();
    expect(logger.logger.warn).not.toHaveBeenCalledOnce();
  });

  it('reports nothing if there are no any reports', () => {
    reportErrors();
    expect(logger.logger.warn).not.toHaveBeenCalled();
  });

  it('reports same warning once', () => {
    const schema = z.object(
      {
        foo: z.string(),
      },
      {
        description: 'Some test schema',
      }
    );
    const invalidData = { foo: 42 };

    checkSchema(schema, invalidData);
    checkSchema(schema, invalidData);
    checkSchema(schema, invalidData);
    checkSchema(schema, invalidData);
    reportErrors();

    expect(logger.logger.warn).toHaveBeenCalledOnce();
    expect(logger.logger.warn.mock.calls[0]).toMatchObject([
      { description: 'Some test schema' },
      'Schema validation error',
    ]);
  });

  it('reports unspecified schema', () => {
    const schema = z.object({
      foo: z.string(),
    });
    const invalidData = { foo: 42 };

    checkSchema(schema, invalidData);
    reportErrors();

    expect(logger.logger.warn).toHaveBeenCalledOnce();
    expect(logger.logger.warn.mock.calls[0]).toMatchObject([
      { description: 'Unspecified schema' },
      'Schema validation error',
    ]);
  });
});
