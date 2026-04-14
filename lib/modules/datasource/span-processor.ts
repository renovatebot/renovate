import type { Context } from '@opentelemetry/api';
import type {
  ReadableSpan,
  Span,
  SpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { ATTR_CODE_FUNCTION_NAME } from '@opentelemetry/semantic-conventions';
import {
  ATTR_RENOVATE_DATASOURCE,
  ATTR_RENOVATE_PACKAGE_NAME,
  ATTR_RENOVATE_REGISTRY_URL,
} from '../../instrumentation/types.ts';
import { GetReleasesStats } from '../../util/stats.ts';

export class GetReleasesSpanProcessor implements SpanProcessor {
  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  onStart(_span: Span, _parentContext: Context): void {
    // no implementation
  }

  onEnd(span: ReadableSpan): void {
    if (!span.ended) {
      return;
    }

    if (span.attributes[ATTR_CODE_FUNCTION_NAME] !== 'getReleases') {
      return;
    }

    const datasource = span.attributes[ATTR_RENOVATE_DATASOURCE] as string;
    const registryUrl = (span.attributes[ATTR_RENOVATE_REGISTRY_URL] ??
      '') as string;
    const packageName = span.attributes[ATTR_RENOVATE_PACKAGE_NAME] as string;

    if (!datasource || !packageName) {
      return;
    }

    // duration[0] is seconds, duration[1] is nanoseconds.
    const durationMs = span.duration[0] * 1000 + span.duration[1] / 1_000_000;

    GetReleasesStats.write(datasource, registryUrl, packageName, durationMs);
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
