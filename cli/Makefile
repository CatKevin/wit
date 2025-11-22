SHELL := /bin/bash

.PHONY: build smoke

build:
	npm run build

smoke: build
	NO_COLOR=1 bash scripts/smoke.sh
