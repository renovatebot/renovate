import { MAVEN_REPO } from '../maven/common.ts';
import { MavenDatasource } from '../maven/index.ts';
import { CLOJARS_REPO } from './common.ts';

export class ClojureDatasource extends MavenDatasource {
  static override readonly id = 'clojure';

  constructor() {
    super(ClojureDatasource.id);
  }

  override readonly registryStrategy = 'merge';

  override readonly defaultRegistryUrls = [CLOJARS_REPO, MAVEN_REPO];
}
