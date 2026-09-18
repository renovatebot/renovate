# Google provider: https://registry.terraform.io/providers/hashicorp/google

# google_cloud_run_service resources
# https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/cloud_run_service
resource "google_cloud_run_service" "default" {
  name = "cloudrun-service"

  template {
    spec {
      containers {
        image = "us-docker.pkg.dev/project/repo/image:1.2.3"
      }
      containers {
        image = "us-docker.pkg.dev/project/repo/other:2.0.0"
      }
    }
  }
}

resource "google_cloud_run_service" "invalid" {
  name = "cloudrun-service-invalid"

  template {
    spec {
      containers {
        name = "invalid"
      }
    }
  }
}

resource "google_cloud_run_service" "ignore_variable" {
  name = "cloudrun-service-variable"

  template {
    spec {
      containers {
        image = "${var.container_image}"
      }
    }
  }
}

# google_cloud_run_v2_service resource
# https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/cloud_run_v2_service
resource "google_cloud_run_v2_service" "default" {
  name = "cloudrun-service-v2"

  template {
    containers {
      image = "us-docker.pkg.dev/project/repo/v2:3.4.5"
    }
    sandboxes {
      templates {
        image = "us-docker.pkg.dev/project/repo/sandbox:0.1.0"
      }
    }
  }
}

# google_cloud_run_v2_worker_pool resource
# https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/cloud_run_v2_worker_pool
resource "google_cloud_run_v2_worker_pool" "default" {
  name = "worker-pool"

  template {
    containers {
      image = "us-docker.pkg.dev/project/repo/worker:1.0.0"
    }
  }
}

# google_cloud_run_v2_job resource
# https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/cloud_run_v2_job
resource "google_cloud_run_v2_job" "default" {
  name = "cloudrun-job"

  template {
    template {
      containers {
        image = "gcr.io/project/job:2.1.0"
      }
    }
  }
}

# https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/app_engine_flexible_app_version
resource "google_app_engine_flexible_app_version" "default" {
  deployment {
    container {
      image = "gcr.io/project/appengine:1.5.0"
    }
  }
}

# https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/workstations_workstation_config
resource "google_workstations_workstation_config" "default" {
  container {
    image = "us-docker.pkg.dev/project/repo/workstation:1.1.0"
  }
}

# https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/dataproc_batch
resource "google_dataproc_batch" "default" {
  runtime_config {
    container_image = "us-docker.pkg.dev/project/repo/dataproc:2.2.0"
  }
}

# https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/dataproc_session_template
resource "google_dataproc_session_template" "default" {
  runtime_config {
    container_image = "us-docker.pkg.dev/project/repo/session:2.3.0"
  }
}

# https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/dataplex_task
resource "google_dataplex_task" "default" {
  spark {
    infrastructure_spec {
      container_image {
        image = "us-docker.pkg.dev/project/repo/dataplex-spark:1.0.0"
      }
    }
  }
  notebook {
    infrastructure_spec {
      container_image {
        image = "us-docker.pkg.dev/project/repo/dataplex-notebook:1.1.0"
      }
    }
  }
}

# https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/vertex_ai_reasoning_engine
resource "google_vertex_ai_reasoning_engine" "default" {
  spec {
    container_spec {
      image_uri = "us-docker.pkg.dev/project/repo/reasoning:3.0.0"
    }
  }
}

# https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/vertex_ai_endpoint_with_model_garden_deployment
resource "google_vertex_ai_endpoint_with_model_garden_deployment" "default" {
  model_config {
    container_spec {
      image_uri = "us-docker.pkg.dev/project/repo/model-garden:4.0.0"
    }
  }
}

# https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/firebase_app_hosting_build
resource "google_firebase_app_hosting_build" "default" {
  source {
    container {
      image = "us-docker.pkg.dev/project/repo/firebase:5.0.0"
    }
  }
}

# https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/bigquery_routine
resource "google_bigquery_routine" "default" {
  spark_options {
    container_image = "us-docker.pkg.dev/project/repo/bigquery:6.0.0"
  }
}

# https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/cloudbuild_trigger
resource "google_cloudbuild_trigger" "default" {
  build {
    step {
      name = "gcr.io/cloud-builders/docker:5.0.0"
    }
    step {
      name = "us-docker.pkg.dev/project/builders/go:1.21"
    }
  }
}

# https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/network_services_wasm_plugin
resource "google_network_services_wasm_plugin" "default" {
  versions {
    image_uri = "us-docker.pkg.dev/project/repo/wasm:7.0.0"
  }
  versions {
    image_uri = "us-docker.pkg.dev/project/repo/wasm:7.1.0"
  }
}

# https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/dataproc_gdc_spark_application
resource "google_dataproc_gdc_spark_application" "default" {
  dependency_images = [
    "us-docker.pkg.dev/project/repo/dep-a:1.0.0",
    "us-docker.pkg.dev/project/repo/dep-b:2.0.0",
  ]
}

# https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/clouddeploy_custom_target_type
resource "google_clouddeploy_custom_target_type" "default" {
  tasks {
    deploy {
      container {
        image = "us-docker.pkg.dev/project/deployers/custom:1.0.0"
      }
    }
    render {
      container {
        image = "us-docker.pkg.dev/project/renderers/custom:1.1.0"
      }
    }
  }
}

# https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/clouddeploy_delivery_pipeline
resource "google_clouddeploy_delivery_pipeline" "default" {
  serial_pipeline {
    stages {
      strategy {
        canary {
          canary_deployment {
            verify_config {
              tasks {
                container {
                  image = "us-docker.pkg.dev/project/verifiers/canary:1.0.0"
                }
              }
            }
            predeploy {
              actions = ["deploy-action"]
            }
          }
        }
        standard {
          predeploy {
            tasks {
              container {
                image = "us-docker.pkg.dev/project/deploys/standard:2.0.0"
              }
            }
          }
          postdeploy {
            tasks {
              container {
                image = "us-docker.pkg.dev/project/deploys/standard-post:2.1.0"
              }
            }
          }
          verify_config {
            tasks {
              container {
                image = "us-docker.pkg.dev/project/verifiers/standard:2.2.0"
              }
            }
          }
        }
      }
    }
    stages {
      strategy {
        canary {
          custom_canary_deployment {
            phase_configs {
              verify_config {
                tasks {
                  container {
                    image = "us-docker.pkg.dev/project/verifiers/phase:3.0.0"
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
