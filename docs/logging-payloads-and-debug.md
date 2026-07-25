# Logging: Transaction Payloads, Memos, and Debug Mode

This guide extends [Logging Guidance](./logging.md) with the payload-level and
debug-mode concerns that matter most for a payments SDK. The base guide covers
secret keys, safe identifiers, and error logging; this one focuses on the parts
of a transaction flow that are easy to leak by accident: signed payloads, memos,
raw network bodies, and verbose debug output.

> [!CAUTION]
> The single most damaging leak is a secret key or wallet seed phrase. Never log
> `secretKey`, mnemonics, seed phrases, or any raw signing material - at any log
> level, in any environment.

## Secret material that is easy to miss

The base guide calls out secret keys. In practice these related values are just
as sensitive and are often logged by accident:

- **Seed phrases / mnemonics** - anything that can re-derive a keypair.
- **Signed transaction XDR** - a signed envelope embeds signatures produced with
  the secret key. Treat signed XDR as sensitive.
- **Raw signing inputs** - the transaction hash bytes passed to a signer,
  together with the key.

## Transaction payloads and signed XDR

A Stellar transaction envelope is serialised as base64 XDR. An **unsigned** XDR
mostly reveals public data (source account, operations, memo), but a **signed**
XDR additionally carries signatures. Dumping full signed envelopes into logs is
a common leak and makes the log store a replay/inspection target.

Unsafe:

​
const signed = tx.toEnvelope().toXDR("base64");
logger.info("Submitting transaction", { signedXDR: signed }); // leaks signatures
console.log("Envelope:", tx.toEnvelope());                     // dumps everything

Safe - log stable, public references instead of the payload:

​
logger.info("Submitting transaction", {
source: publicKey, // G... public key, safe
operationCount: tx.operations.length,
fee: tx.fee,
txHash: tx.hash().toString("hex"), // the hash, not the signed envelope
});

If you must capture an envelope for debugging, log the **unsigned** XDR only,
behind an explicit debug flag, and never in production.

## Memos can carry personal data

Stellar memos (`MEMO_TEXT`, `MEMO_ID`, `MEMO_HASH`) are frequently used to tag
payments with an order id, customer reference, or exchange deposit tag. A memo
may therefore be personal or account-linking data even though it is not a
secret. Do not log memos verbatim by default.

​
// Unsafe: memo may identify a user
logger.info("Payment sent", { destination, amount, memo: tx.memo.value });
// Safe: record only that a memo was present, and its type
logger.info("Payment sent", {
destination,
amount,
memoType: tx.memo.type, // e.g. "text" | "id" | "hash" | "none"
hasMemo: tx.memo.type !== "none",
});

## Horizon and Soroban request/response bodies

Submission calls echo the signed transaction back in the request body, and some
error responses include the submitted envelope. Logging raw HTTP bodies can
therefore re-introduce the signed-XDR leak described above.

- Do **not** log full Horizon/Soroban request bodies for `submitTransaction`.
- On success, log the tx hash and ledger.
- On failure, log the status code and the parsed `result_codes`, not the raw
  body.

​
try {
const res = await server.submitTransaction(tx);
logger.info("Submitted", { txHash: res.hash, ledger: res.ledger });
} catch (err) {
logger.error("Submit failed", {
status: err?.response?.status,
resultCodes: err?.response?.data?.extras?.result_codes, // safe summary
// NOT: err.response.data (may contain the signed envelope)
});
}

## A reusable redaction helper

Centralise redaction so no call site has to remember the rules. Deny-list the
known-sensitive keys and log everything else:

​
const SENSITIVE_KEYS = [
"secretKey",
"secret",
"seed",
"seedPhrase",
"mnemonic",
"signedXDR",
"signature",
"signatures",
"privateKey",
];
export function redactSensitive<T>(value: T): T {
if (Array.isArray(value)) {
return value.map(redactSensitive) as unknown as T;
}
if (value && typeof value === "object") {
const out: Record<string, unknown> = {};
for (const [k, v] of Object.entries(value)) {
out[k] = SENSITIVE_KEYS.includes(k) ? "[REDACTED]" : redactSensitive(v);
}
return out as T;
}
return value;
}
// Usage
logger.info("Signing", redactSensitive({ publicKey, secretKey, txHash }));
// -> { publicKey: "G...", secretKey: "[REDACTED]", txHash: "..." }

A deny-list keeps useful debug context while guaranteeing the known secret
fields never reach the log sink. Pair it with the safe-identifier table in the
[base guide](./logging.md#safe-identifiers-to-log).

## Debug mode expectations

Verbose logging is useful while developing and dangerous in production. The SDK
and its consumers should follow these rules:

- **Off by default.** Debug logging must be opt-in via an explicit flag or
  environment variable (for example `POCKETPAY_DEBUG=true`), never on by default.
- **Redaction still applies.** Debug mode may add volume (unsigned XDR, operation
  details, timings) but must still route through `redactSensitive` and must never
  print secret keys, seed phrases, or signed envelopes.
- **No verbose payload logging in production.** Production log levels should emit
  only monitoring-grade events (tx hash, ledger, status, error code).
- **Fail safe.** If you are unsure whether a value is sensitive, do not log it.

​
const DEBUG = process.env.POCKETPAY_DEBUG === "true";
function debug(message: string, context: Record<string, unknown> = {}) {
if (!DEBUG) return;
console.debug(message, redactSensitive(context));
}

## Quick reference

| Value | Log by default? | How |
|-------|-----------------|-----|
| Secret key / seed phrase / mnemonic | Never | Omit entirely |
| Signed transaction XDR / signatures | Never | Log tx hash instead |
| Unsigned XDR | Debug only | Behind a debug flag, never in prod |
| Memo value | No | Log `memoType` / `hasMemo` |
| Public key (G...) | Yes | Public by design |
| Transaction hash / ledger | Yes | Already on-chain |
| Horizon `result_codes` | Yes | Safe error summary |
| Raw Horizon/Soroban body | No | Log a parsed summary |

## See also

- [Logging Guidance](./logging.md) - Base safe-logging practices and the safe-identifier table.
- [Error Handling](./error-handling.md) - Logging `PocketPayError` without leaking context.
- [Security Best Practices](./security.md) - Key management and transaction safety.