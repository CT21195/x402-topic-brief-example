# An agent pays $0.05 for a topic brief

A runnable example of buying from a pay-per-call API with no account and no API key. Payment is the auth.

## What it buys

`GET /brief/topic?q=<topic>` — **$0.05** — one call returns prediction-market prices for the topic on Polymarket and Kalshi, the SEC EDGAR company record when the topic is a listed company, a spot price when it's a major crypto, and short encyclopedia context.

Live API: https://workspace-x402-paywall.onrender.com
Full catalog (181 endpoints, $0.001–$0.05 per call): https://workspace-x402-paywall.onrender.com/llms.txt
Machine-readable spec: https://workspace-x402-paywall.onrender.com/openapi.json

The headline endpoint is `GET /spread` ($0.005) — live SOL CEX/DEX spread and arbitrage data. Token audit is secondary; NPI verification is a minor utility, not the product.

## Run it

```bash
npm install
AGENT_PRIVATE_KEY=0x... node example.mjs fed
AGENT_PRIVATE_KEY=0x... node example.mjs NVDA
```

The key must belong to a wallet holding USDC on Base. Use a dedicated agent wallet. The script reads the price from the live 402 response first and refuses to pay anything other than exactly $0.05.

## How it works

1. Unpaid call returns HTTP 402 with payment terms in the `payment-required` header.
2. The script signs a USDC EIP-3009 `TransferWithAuthorization` on Base (chain 8453) for exactly the quoted amount.
3. It retries the same request with the signed payment in the `PAYMENT-SIGNATURE` header and prints the brief.

No x402 SDK required — just `viem` for signing and plain `fetch`.
