LOG_LEVEL := info
RENOVATE_CONFIG_FILE := example/config.json

ifndef RENOVATE_TOKEN
$(error $$RENOVATE_TOKEN environment variable must be set)
endif

.PHONY: run
run:
	@LOG_LEVEL=${LOG_LEVEL} \
	 RENOVATE_TOKEN=${RENOVATE_TOKEN} \
	 RENOVATE_CONFIG_FILE=${RENOVATE_CONFIG_FILE} \
	 pnpm start
