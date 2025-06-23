This datasource returns releases from the [Adoptium](https://adoptium.net/) API.

It uses `image_type=<jre|jdk>&project=jdk&release_type=ga&sort_method=DATE&sort_order=DESC` as filter parameters.
This means that the datasource finds:

- JRE or JDK images
- with a JDK project
- which have the General Availability status

And finally, the results are sorted in descending order.

When Renovate contacts the Adoptium API, it fetches 50 pages.
Each page has 50 items.
So 2500 items are fetched from the API in total.

If you want to get releases which come with the JDK, set the `packageName` to `java-jdk` or `java`.

If you want to get releases which come with the JRE, set the `packageName` to `java-jre`.
LTS releases of Java will have a version that comes with the JRE.
Non-LTS releases may not always include the JRE.
