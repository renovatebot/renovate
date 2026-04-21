import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { ATTR_CODE_FUNCTION_NAME } from '@opentelemetry/semantic-conventions';
import { partial } from '~test/util.ts';
import {
  ATTR_RENOVATE_DATASOURCE,
  ATTR_RENOVATE_PACKAGE_NAME,
  ATTR_RENOVATE_REGISTRY_URL,
} from '../../instrumentation/types.ts';
import * as stats from '../../util/stats.ts';
import { defaultRegistryUrl as npmDefaultRegistryUrl } from './npm/common.ts';
import { GetDatasourceReleasesSpanProcessor } from './span-processor.ts';

vi.mock('../../util/stats.ts');

describe('modules/datasource/span-processor', () => {
  describe('GetDatasourceReleasesSpanProcessor', () => {
    it('creates an instance', async () => {
      const processor = new GetDatasourceReleasesSpanProcessor();
      expect(processor).toBeInstanceOf(GetDatasourceReleasesSpanProcessor);
      await expect(processor.forceFlush()).resolves.toBeUndefined();
      expect(processor.onStart(partial(), partial())).toBeUndefined();
      await expect(processor.shutdown()).resolves.toBeUndefined();
    });

    it('writes span datapoints to GetDatasourceReleasesStats', () => {
      const writeMock = vi.mocked(stats.GetDatasourceReleasesStats.write);

      const processor = new GetDatasourceReleasesSpanProcessor();
      processor.onEnd(
        partial<ReadableSpan>({
          ended: true,
          attributes: {
            [ATTR_CODE_FUNCTION_NAME]: 'getReleases',
            [ATTR_RENOVATE_DATASOURCE]: 'npm',
            [ATTR_RENOVATE_REGISTRY_URL]: npmDefaultRegistryUrl,
            [ATTR_RENOVATE_PACKAGE_NAME]: 'lodash',
          },
        }),
      );

      expect(writeMock).toHaveBeenCalledOnce();
      expect(writeMock).toHaveBeenCalledWith(
        'npm',
        npmDefaultRegistryUrl,
        'lodash',
        1500.123,
      );
    });

    it('defaults registryUrl to an empty string if not provided', () => {
      const writeMock = vi.mocked(stats.GetDatasourceReleasesStats.write);

      const processor = new GetDatasourceReleasesSpanProcessor();
      processor.onEnd(
        partial<ReadableSpan>({
          ended: true,
          attributes: {
            [ATTR_CODE_FUNCTION_NAME]: 'getReleases',
            [ATTR_RENOVATE_DATASOURCE]: 'npm',
            [ATTR_RENOVATE_PACKAGE_NAME]: 'lodash',
          },
          duration: [1, 0],
        }),
      );

      expect(writeMock).toHaveBeenCalledOnce();
      expect(writeMock).toHaveBeenCalledWith('npm', '', 'lodash', 1000);
    });

    interface NoWriteTestCase {
      name: string;
      span: Partial<ReadableSpan>;
    }

    const noWriteTestCases: NoWriteTestCase[] = [
      {
        name: 'span is not ended',
        span: {
          ended: false,
          attributes: {
            [ATTR_CODE_FUNCTION_NAME]: 'getReleases',
            [ATTR_RENOVATE_DATASOURCE]: 'npm',
            [ATTR_RENOVATE_REGISTRY_URL]: npmDefaultRegistryUrl,
            [ATTR_RENOVATE_PACKAGE_NAME]: 'lodash',
          },
          duration: [1, 0],
        },
      },
      {
        name: 'function name is not getReleases',
        span: {
          ended: true,
          attributes: {
            [ATTR_CODE_FUNCTION_NAME]: 'somethingElse',
            [ATTR_RENOVATE_DATASOURCE]: 'npm',
            [ATTR_RENOVATE_REGISTRY_URL]: npmDefaultRegistryUrl,
            [ATTR_RENOVATE_PACKAGE_NAME]: 'lodash',
          },
          duration: [1, 0],
        },
      },
      {
        name: 'datasource is not provided',
        span: {
          ended: true,
          attributes: {
            [ATTR_CODE_FUNCTION_NAME]: 'getReleases',
            [ATTR_RENOVATE_REGISTRY_URL]: npmDefaultRegistryUrl,
            [ATTR_RENOVATE_PACKAGE_NAME]: 'lodash',
          },
          duration: [1, 0],
        },
      },
      {
        name: 'package name is not provided',
        span: {
          ended: true,
          attributes: {
            [ATTR_CODE_FUNCTION_NAME]: 'getReleases',
            [ATTR_RENOVATE_DATASOURCE]: 'npm',
            [ATTR_RENOVATE_REGISTRY_URL]: npmDefaultRegistryUrl,
          },
          duration: [1, 0],
        },
      },
    ];

    test.each(noWriteTestCases)(
      'does not write span datapoints to GetDatasourceReleasesStats if $name',
      ({ span }) => {
        const writeMock = vi.mocked(stats.GetDatasourceReleasesStats.write);
        const processor = new GetDatasourceReleasesSpanProcessor();
        processor.onEnd(partial<ReadableSpan>(span));
        expect(writeMock).not.toHaveBeenCalled();
      },
    );
  });
});
