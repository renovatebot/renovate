Updates docker based cnb dependencies for the [spring-boot-maven-plugin](https://docs.spring.io/spring-boot/maven-plugin/build-image.html#build-image.examples.buildpacks).

It updates docker references for:

- `builder`
- `runImage`
- `buildpack`

Example:

```xml
<project>
 <build>
  <plugins>
   <plugin>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-maven-plugin</artifactId>
    <configuration>
     <image>
                        <name>repository.local/demo-spring-boot</name>
      <builder>paketobuildpacks/builder-jammy-base:0.4.316</builder>
      <runImage>paketobuildpacks/run-jammy-full:0.0.10</runImage>
      <buildpacks>
       <buildpack>gcr.io/paketo-buildpacks/java:1.8.0</buildpack>
      </buildpacks>
     </image>
    </configuration>
   </plugin>
  </plugins>
 </build>
</project>
```
