The `osgifeature` manager extracts dependencies from feature model definition files, typically located under `src/main/features`. It uses `maven` datasource for looking up dependency updates.

Limitations:

- artifact list extensions as defined in section 159.7.3 of the OSGi R8 spec are not supported yet.

References:

- [OSGi compendium release 8, Feature Service Specification](https://docs.osgi.org/specification/osgi.cmpn/8.0.0/service.feature.html)
- [The Sling implementation of the feature model](https://sling.apache.org/documentation/development/feature-model.html)
