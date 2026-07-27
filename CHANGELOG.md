# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Opt-in SDK diagnostics (`src/diagnostics/`): redacted lifecycle hooks, `buildDiagnosticsReport`, and support guide (`docs/diagnostics.md`) for configuration, network, transaction, wallet, and vault observability without leaking secrets
- Initial SDK release with wallet management, XLM payments, and transaction history
- Soroban savings-vault helpers (`depositToVault`, `withdrawFromVault`, `getVaultBalance`)
- Network error handling with retry guidance
- Comprehensive documentation covering getting started, error handling, logging, security, and release preparation
- GitHub Actions CI pipeline
- Contribution guidelines
- Added a complete SDK release-readiness and migration system for maintainers, including release gates, public API review, security review, changelog policy, deprecation guidance, and a reusable migration-note template

[Unreleased]: https://github.com/Axionvera/pocketpay-sdk/compare/main...HEAD
