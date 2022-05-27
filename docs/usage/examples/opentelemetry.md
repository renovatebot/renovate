# OpenTelemetry

Requirements:

- docker-compose

## Prepare setup

Create a `docker-compose.yaml` and `otel-collector-config.yml` file as seen below in a folder

`docker-compose.yaml`:

```yaml
version: '3'
services:
  # Jaeger
  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - '16686:16686'
      - '14250'

  otel-collector:
    image: otel/opentelemetry-collector:0.52.0
    command: ['--config=/etc/otel-collector-config.yml']
    volumes:
      - ./otel-collector-config.yml:/etc/otel-collector-config.yml
    ports:
      - '1888:1888' # pprof extension
      - '13133:13133' # health_check extension
      - '55679:55679' # zpages extension
      - '4318:4318' # OTLP HTTP
      - '4317:4317' # OTLP GRPC
    depends_on:
      - jaeger
```

`otel-collector-config.yml`:

```yaml
receivers:
  otlp:
    protocols:
      grpc:
      http:
  zipkin:

exporters:
  jaeger:
    endpoint: jaeger:14250
    tls:
      insecure: true
  logging:

processors:
  batch:

extensions:
  health_check:
  pprof:
  zpages:

service:
  extensions: [pprof, zpages, health_check]
  pipelines:
    traces:
      receivers: [otlp]
      exporters: [jaeger, logging]
      processors: [batch]
```

Start setup using this command inside the folder containing the files created in the earlier steps:

```
docker-compose up
```

This command will start an [OpenTelemetry Collector](https://github.com/open-telemetry/opentelemetry-collector-contrib) and an instance of [Jaeger](https://www.jaegertracing.io/)

Jaeger will be now reachable under [http://localhost:16686](http://localhost:16686)

## Run Renovate with OpenTelemetry

To start Renovate with OpenTelemetry enabled run following command, after pointing to your `config.js` config file:

```
docker run \
  --rm \
  -e OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 \
  -v "/path/to/your/config.js:/usr/src/app/config.js" \
  renovate/renovate:latest
```

You should now see `trace_id` and `span_id` fields in the logs

```
 INFO: Repository finished (repository=org/example)
       "durationMs": 5574,
       "trace_id": "f9a4c33852333fc2a0fbdc163100c987",
       "span_id": "4ac1323eeaee
```

Open now Jaeger under [http://localhost:16686](http://localhost:16686)

You should now be able to pick `renovate` under in the field `service` field

![service picker](../assets/images/opentelemetry_pick_service.png)

Press `Find Traces` to search for all Renovate traces and then click on one of the found traces to open the trace view.

![pick trace](../assets/images/opentelemetry_choose_trace.png)

You should able to see now the full trace view which shows each HTTP request and internal spans

![trace view](../assets/images/opentelemetry_trace_viewer.png)
