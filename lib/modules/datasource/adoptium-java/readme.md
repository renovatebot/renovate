This datasource returns releases from the [Adoptium](https://adoptium.net/) API.

It uses `image_type=<jre|jdk>&project=jdk&release_type=ga&sort_method=DATE&sort_order=DESC&vendor=adoptium` as filter parameters.

It only uses the first 50 pages with 50 items per page.

If you want to get releases which come with the JDK, set the `packageName` to `java-jdk` or `java`.

If you want to get releases which come with the JRE, set the `packageName` to `java-jre`.
Currently, only LTS releases of Java come with the JRE.
