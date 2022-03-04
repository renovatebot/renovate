import { MavenDatasource } from '../maven';
import { MAVEN_REPO } from '../maven/common';

export class ClojureDatasource extends MavenDatasource {
  static override readonly id = 'clojure';

  constructor() {
    super(ClojureDatasource.id);
  }

  override readonly registryStrategy = 'merge';

  override readonly defaultRegistryUrls = [
    'https://clojars.org/repo',
    MAVEN_REPO,
  ];
}
