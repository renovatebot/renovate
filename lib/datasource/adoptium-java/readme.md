This datasource returns releases from [Adoptium](https://adoptium.net/) API.

It uses `image_type=<jre|jdk>&project=jdk&release_type=ga&sort_method=DATE&sort_order=DESC&vendor=adoptium` as filter parameters.

It only uses the first 50 pages with 50 items per page.

Use `java-jdk` or `java` as `lookupName` to get releases with JDK available or use `java-jre` to only get releases with JRE available.
Currently only the LTS releases have a JRE available.
