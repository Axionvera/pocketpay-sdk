# PocketPay SDK Roadmap

This roadmap describes the expected direction of the PocketPay SDK and helps
contributors find useful areas of work. It is directional rather than a fixed
delivery plan: priorities may change as the SDK, the PocketPay mobile app, and
the related Soroban contracts evolve. Items listed here are planned or
candidate improvements, not guaranteed features or commitments to delivery
dates, Mainnet readiness, production readiness, or an audit.

Before starting a roadmap item, open or find a focused issue so its scope and
acceptance criteria can be agreed with maintainers. Changes should preserve the
SDK's documented public API where practical and include documentation and tests
appropriate to the change.

## Phase 1: SDK foundation

### Goal

Keep the TypeScript package predictable, easy to configure, and straightforward
for applications and contributors to adopt.

### Planned improvements

- Clarify supported runtimes, network configuration, package-root exports, and
  error behavior.
- Improve consistency across public types, response models, and configuration
  validation.
- Expand focused examples for common Testnet workflows without presenting them
  as production guidance.
- Continue refining contributor documentation and local development workflows.

### Contributor opportunities

- Identify gaps or inconsistencies in the API reference and getting-started
  guide.
- Propose small type-safety, validation, or error-message improvements through
  focused issues.
- Add examples that demonstrate existing public APIs and clearly state their
  network assumptions.

## Phase 2: Wallet and payment reliability

### Goal

Make wallet creation, account funding, balance lookup, and XLM payment flows
more reliable and easier for SDK consumers to handle safely.

### Planned improvements

- Strengthen input validation and provide consistent, actionable errors for
  invalid keys, amounts, destinations, and network failures.
- Refine handling for unfunded accounts and other expected Stellar account
  states.
- Improve payment submission feedback and document safe retry behavior so
  consumers can avoid accidental duplicate payments.
- Expand wallet backup and secret-key handling guidance while keeping secure
  storage the responsibility of the consuming application.

### Contributor opportunities

- Document reproducible wallet or payment edge cases on Testnet.
- Add focused test cases for validation, Horizon failures, and response mapping.
- Improve examples and documentation for recoverable versus terminal errors.

## Phase 3: Transaction history

### Goal

Provide stable, useful transaction and payment history models that applications
can paginate and present consistently.

### Planned improvements

- Continue refining SDK-owned transaction and payment summaries instead of
  exposing consumers directly to raw Horizon response shapes.
- Improve cursor pagination guidance and behavior for empty pages and subsequent
  requests.
- Evaluate candidate filters and normalized fields based on concrete mobile and
  SDK consumer needs.
- Clarify timestamp, memo, asset, fee, and operation-count semantics in the
  public documentation.

### Contributor opportunities

- Report real response shapes that expose gaps in the current summary models.
- Add fixtures and tests for pagination, failed transactions, memos, and
  non-native assets where they match an agreed issue.
- Improve transaction-history examples for UI-friendly loading and empty states.

## Phase 4: Soroban vault integration

### Goal

Evolve the SDK's savings-vault helpers alongside the separately deployed
PocketPay Soroban contract while keeping contract assumptions explicit.

### Planned improvements

- Refine deposit, withdrawal, and vault-balance helpers as the contract interface
  evolves.
- Improve validation of contract IDs, RPC configuration, authorization, and
  transaction simulation results.
- Provide clearer error mapping and documentation for contract-call failures.
- Explore candidate abstractions for contract version compatibility without
  implying that a deployment is audited or Mainnet-ready.

### Contributor opportunities

- Compare SDK helper assumptions with the current contract interface and report
  mismatches through focused issues.
- Improve Testnet setup examples using explicitly configured contract IDs.
- Add deterministic tests around request construction, simulation, and error
  mapping where practical.

## Phase 5: Mobile app integration

### Goal

Make the SDK easier for the PocketPay mobile app to consume without moving
mobile UI, persistence, or secret storage responsibilities into the SDK.

### Planned improvements

- Gather mobile integration feedback around package imports, asynchronous state,
  pagination, and error presentation.
- Improve examples for wallet onboarding, payment progress, and history loading.
- Evaluate candidate API refinements for mobile runtime compatibility and
  application lifecycle constraints.
- Clarify the boundary between SDK operations and app-owned secure storage,
  navigation, caching, and user experience.

### Contributor opportunities

- Reproduce mobile integration issues in small, SDK-focused examples.
- Document runtime or bundler compatibility findings with environment details.
- Propose API changes only after confirming the need across the SDK and mobile
  app repositories.

## Phase 6: Release readiness

### Goal

Build a repeatable release process with clear evidence about package quality,
compatibility, and known limitations.

### Planned improvements

- Keep the release checklist, changelog, API documentation, and package metadata
  aligned with each candidate release.
- Strengthen automated checks for types, tests, packaging, and public exports.
- Verify installation and representative Testnet workflows from the published
  package before broader release claims are considered.
- Document compatibility expectations, breaking-change handling, security
  reporting, and known limitations.

### Contributor opportunities

- Exercise release candidates in clean projects and report reproducible results.
- Review public exports and documentation for accidental omissions or breaking
  changes.
- Improve release verification steps without treating checklist completion as an
  audit or a guarantee of production readiness.

## Contributing to the roadmap

The most useful roadmap contributions are small, evidence-based, and connected
to a focused issue. When proposing an item, describe the SDK consumer problem,
the expected public behavior, relevant repository boundaries, and how the change
can be verified. Maintainers may reorder, reshape, or defer items as PocketPay's
needs and dependencies change.