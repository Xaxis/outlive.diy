# outlive.diy: one entry point for everything.
#
# Every target here is also run by CI, so what a contributor runs locally and
# what the build runs cannot drift apart.
#
#   make           list targets
#   make check     everything CI runs
#   make dev       the app, locally

SHELL := /bin/bash
.DEFAULT_GOAL := help

.PHONY: help install dev build start offline clean \
        check check-fast test coverage lint type-check format format-check \
        guard-data guard-check fonts fonts-check no-network deploy preview

help: ## List available targets
	@grep -hE '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) \
	  | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[1m%-14s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies, pinned to match CI
	yarn install --frozen-lockfile

dev: ## Run the app locally
	@yarn workspace @outlive/web dev

build: ## Build the static site into apps/web/out
	@yarn workspace @outlive/web build

offline: ## Build a copy that opens from disk with no server: apps/web/out/index.html
	@OUTLIVE_RELATIVE_ASSETS=1 yarn workspace @outlive/web build
	@echo
	@echo "Open apps/web/out/index.html directly in a browser."
	@echo "The two typefaces are served by path and will fall back to the system stack."

start: ## Serve the built static site
	@yarn workspace @outlive/web start

# --- verification ------------------------------------------------------------
# Each of these is a claim the repository makes about itself.

test: ## Both test suites: the engine, and the interface driven end to end
	@yarn workspace @outlive/core test
	@yarn workspace @outlive/web test

test-core: ## The engine's suite alone
	@yarn workspace @outlive/core test

test-web: ## The interface's suite alone
	@yarn workspace @outlive/web test

coverage: ## The engine's test suite, with coverage
	@yarn workspace @outlive/core coverage

type-check: ## Both workspaces type-check
	@yarn workspace @outlive/core type-check
	@yarn workspace @outlive/web type-check

lint: ## The app lints
	@yarn workspace @outlive/web lint

format-check: ## Formatting is what prettier would produce
	@yarn prettier --check .

format: ## Make it so
	@yarn prettier --write .

guard-data: ## Regenerate the checked-in BIP-39 wordlist
	@node tools/gen-bip39-wordlist.mjs

guard-check: ## The checked-in wordlist matches the canonical one
	@node tools/gen-bip39-wordlist.mjs --check

fonts: ## Copy the checked-in fonts from their packages
	@node tools/sync-fonts.mjs

fonts-check: ## The checked-in fonts match the packages they came from
	@node tools/sync-fonts.mjs --check

no-network: ## No source in the app can reach the network
	@node tools/check-no-network.mjs

check-fast: guard-check fonts-check no-network type-check lint format-check test ## Everything except the site build

check: check-fast build ## Everything CI runs

clean: ## Remove build output
	@rm -rf apps/web/.next apps/web/.next-dev apps/web/out packages/core/coverage

# --- hosting -----------------------------------------------------------------

preview: ## Deploy a preview to Vercel
	@vercel deploy --token "$$VERCEL_TOKEN"

deploy: ## Deploy to production
	@vercel deploy --prod --token "$$VERCEL_TOKEN"
