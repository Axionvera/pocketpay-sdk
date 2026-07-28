# SDK Security Threat Model

This document outlines the security assumptions, trust boundaries, and specific threat models for the **PocketPay SDK**. It is designed to guide both internal contributors and integrating developers in maintaining the security posture of the application.

---

## 1. Trust Boundaries and Data Flow

The PocketPay SDK operates within a defined trust boundary. It is critical to understand what the SDK protects and what falls under the responsibility of the host application or external network.

- **Host Application (e.g., PocketPay Mobile)**: **Out of Scope for SDK**. The host application is solely responsible for the persistent, secure storage of cryptographic secrets (e.g., iOS Keychain, Android Keystore), biometric authentication, and protecting the device from physical compromise or root-level malware.
- **PocketPay SDK**: **In Scope**. The SDK is responsible for securely processing secrets *in memory* during signing, safely constructing transactions without malleability, securely communicating with configured RPC endpoints, and preventing accidental leakage through logs or diagnostics.
- **RPC / Backend Layer**: **Out of Scope for SDK**. The SDK assumes the configured Horizon/Soroban RPC endpoints are secured via TLS and operated by trusted infrastructure providers.

---

## 2. Sensitive Module Map

The SDK codebase is segmented by risk surface. Contributors modifying these directories must adhere to strict security reviews:

| Module | Risk Surface | Key Threat Vectors |
| --- | --- | --- |
| `src/wallet/` | High (Secret Handling) | Memory scraping, insecure key generation, accidental secret export. |
| `src/transactions/` | Medium (State Mutation) | Replay attacks, transaction malleability, incorrect fee modeling. |
| `src/network/` | Medium (Data Transport) | TLS stripping, endpoint spoofing, insecure retries. |
| `src/soroban/` & `src/vault/` | High (Smart Contracts) | Contract ID spoofing, malicious payload injection, unauthorized invocation. |

---

## 3. Threat Vectors & Mitigations

### 3.1 Wallet and Signer Risks
- **Threat**: Memory Scraping / Key Extraction.
- **Mitigation**: The SDK retains keys in memory only for the minimum duration required to sign a transaction. 
- **Out of Scope**: The SDK does *not* write keys to disk. If an integrating app writes the key to insecure `AsyncStorage` instead of a secure enclave, that is a host application vulnerability.

### 3.2 Transaction Construction & Signing Risks
- **Threat**: Transaction Malleability and Replay Attacks.
- **Mitigation**: The SDK explicitly manages sequence numbers and sets explicit time bounds (`setTimeout`) on all transaction construction to prevent unbounded validity periods. The `signTransaction` and `prepareTransactionOffline` helpers enforce strict type-checking before applying any Ed25519 signatures.

### 3.3 Transaction Retry & Duplicate Submission Risks
- **Threat**: Unintended duplicate payments due to network timeouts and naive retries.
- **Mitigation**: The SDK enforces strict retry policies. Retries for state-mutating transactions only occur on specific HTTP status codes (e.g., `429 Too Many Requests`, `503 Service Unavailable`). Timeout classification strictly limits retries if a transaction's inclusion state on the ledger is ambiguous.

### 3.4 Diagnostics and Logging Risks
- **Threat**: Secret leakage via logs, error payloads, or crash reports (e.g., Sentry).
- **Mitigation**: The SDK employs a strict redaction policy. Passwords, secret keys, and seed phrases are never included in error messages, stack traces, or diagnostic payloads. Error handling modules sanitize outputs before yielding to the host application.

### 3.5 Soroban Invocation Risks
- **Threat**: Malicious contract invocation or payload injection.
- **Mitigation**: `src/soroban/` and `src/vault/` helpers strictly type-check and sanitize all inputs before serializing to XDR. Vault contract IDs must be explicitly passed in the SDK configuration to prevent endpoint spoofing.

### 3.6 Network and RPC Risks
- **Threat**: Man-in-the-Middle (MitM) attacks or data interception.
- **Mitigation**: All network calls in `src/network/` enforce HTTPS/TLS connections. Downgrade attacks are mitigated by rejecting non-secure endpoints in production configurations.

---

## 4. Security Checklists

To maintain the security posture of the PocketPay SDK, all contributors and reviewers must follow strict guidelines when modifying the sensitive modules listed above.

### 4.1 Contributor Security Checklist
Before opening a PR, contributors must ensure the following:
- [ ] **Dependency Auditing**: No new dependencies are introduced without strict review. Avoid arbitrary supply chain risks.
- [ ] **Secure Memory Management**: Secret keys, seed phrases, and sensitive payloads are not logged, exported, or leaked into variables that could be captured by stack traces or error boundaries.
- [ ] **Secure RNG**: Any entropy generation exclusively uses cryptographically secure random number generators (CSPRNG).
- [ ] **Error Handling**: All error outputs are sanitized before they are thrown to the host application to prevent secret leakage.
- [ ] **Input Validation**: All public API inputs (public keys, amounts, memos) are strictly validated before processing or serialization.

### 4.2 Reviewer Checklist
Reviewers MUST verify the following before approving changes to sensitive modules:
- [ ] Are cryptographic secrets held in memory only for the minimum necessary duration?
- [ ] Do any new error messages or diagnostic events inadvertently include secrets, passwords, or PII?
- [ ] Are new network calls enforcing HTTPS/TLS and validating endpoints?
- [ ] Is transaction construction strictly typed and protected against malleability (e.g., proper sequence numbers and timebounds)?
- [ ] For Soroban: Are contract IDs and payloads explicitly validated before invocation?
- [ ] Are any new dependencies strictly necessary, and have they been audited for supply chain attacks?
