import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';

export class NoopDatasource extends Datasource {
  static readonly id = 'noop';

  override readonly customRegistrySupport = false;

  constructor() {
    super(NoopDatasource.id);
  }

  override getReleases({
    currentValue,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const releases = currentValue ? [{ version: currentValue }] : [];
    return Promise.resolve({ releases });
  }
}
