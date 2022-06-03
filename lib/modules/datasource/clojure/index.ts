import { MavenDatasource } from '../maven';
import { MAVEN_REPO } from '../maven/common';
import { CLOJARS_REPO } from './common';

export class ClojureDatasource extends MavenDatasource {
  static override readonly id = 'clojure';

  constructor() {
    super(ClojureDatasource.id);
  }

  override readonly registryStrategy = 'merge';

  override readonly defaultRegistryUrls = [CLOJARS_REPO, MAVEN_REPO];
}
