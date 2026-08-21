The `html` manager updates `<script>` tags and CSS `<link>` tags that point to the [cdnjs content delivery network](https://cdnjs.com/).
It also updates Subresource Integrity (SRI) hashes in `integrity` attributes.

Key differences between the `cdnurl` manager and the `html` manager:

- The `html` manager updates SRI hashes, the `cndurl` manager does not
- The `html` manager automatically finds some files to update, the `cndurl` manager must be given a `managerFilePatterns`
