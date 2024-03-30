import type {SpaceHttp} from "../../../../util/http/space";
import {SpaceRepositoryClient} from "./repository";
import {SpaceJobsClient} from "./jobs";
import {SpaceCodeReviewClient} from "./code-review";

export class SpaceClient {
  repository: SpaceRepositoryClient
  jobs: SpaceJobsClient
  codeReview: SpaceCodeReviewClient

  constructor(http: SpaceHttp) {
    this.repository = new SpaceRepositoryClient(http)
    this.jobs = new SpaceJobsClient(http)
    this.codeReview = new SpaceCodeReviewClient(http)
  }
}
