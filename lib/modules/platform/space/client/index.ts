import { SpaceHttp } from '../../../../util/http/space';
import { SpaceCodeReviewClient } from './code-review';
import { SpaceJobsClient } from './jobs';
import { SpaceRepositoryClient } from './repository';

export class SpaceClient {
  repository: SpaceRepositoryClient;
  jobs: SpaceJobsClient;
  codeReview: SpaceCodeReviewClient;

  constructor(endpoint: string) {
    const http = new SpaceHttp(endpoint);
    this.repository = new SpaceRepositoryClient(http);
    this.jobs = new SpaceJobsClient(http);
    this.codeReview = new SpaceCodeReviewClient(http);
  }
}
