import type { SpaceHttp } from '../../../../util/http/space';
import { SpaceCodeReviewReadClient } from './code-review-read';
import { SpaceCodeReviewWriteClient } from './code-review-write';

export class SpaceCodeReviewClient {
  read: SpaceCodeReviewReadClient;
  write: SpaceCodeReviewWriteClient;

  constructor(http: SpaceHttp) {
    this.read = new SpaceCodeReviewReadClient(http);
    this.write = new SpaceCodeReviewWriteClient(http);
  }
}
