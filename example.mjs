// Agent pays $0.05 for a topic brief — no account, no API key.
// Payment is the auth: an unpaid call returns HTTP 402 with the price
// and payment terms; this script signs a USDC EIP-3009 authorization
// on Base and retries the same request with it.
//
// Run:
//   npm install
//   AGENT_PRIVATE_KEY=0x... node example.mjs fed
//   AGENT_PRIVATE_KEY=0x... node example.mjs NVDA
//
// The key must belong to a wallet holding USDC on Base (chain 8453)
// plus a little ETH for nothing — EIP-3009 transfers need no gas from
// the payer; the facilitator submits the transfer. Use a dedicated
// agent wallet, never a wallet that holds anything else.
// Cost: exactly $0.05 per call. The script prints the price from the
// live 402 response before signing, and refuses to pay anything else.

import { privateKeyToAccount } from 'viem/accounts';
import { randomBytes } from 'node:crypto';

const API = 'https://workspace-x402-paywall.onrender.com';
const topic = process.argv[2] || 'fed';
const url = `${API}/brief/topic?q=${encodeURIComponent(topic)}`;

const key = process.env.AGENT_PRIVATE_KEY;
if (!key) {
  console.error('Set AGENT_PRIVATE_KEY first (a Base wallet holding USDC).');
  process.exit(1);
}
const account = privateKeyToAccount(key);
console.log('payer:', account.address);
console.log('calling:', url);

// Step 1: unpaid call -> expect 402 with payment terms.
const first = await fetch(url);
console.log('first status:', first.status);
if (first.status !== 402) {
  console.log('unexpected response:', (await first.text()).slice(0, 500));
  process.exit(1);
}
const pr = JSON.parse(Buffer.from(first.headers.get('payment-required'), 'base64').toString());
const acc = pr.accepts.find((a) => a.network === 'eip155:8453');
if (!acc) {
  console.error('No Base (eip155:8453) payment terms in the 402 response.');
  process.exit(1);
}
console.log('price:', acc.amount, 'USDC ->', acc.payTo);
if (acc.amount !== '50000') {
  console.error('Price is not the expected $0.05 (50000 micro-USDC) — refusing to pay.');
  process.exit(1);
}

// Step 2: sign a USDC transfer authorization for exactly that amount.
const now = Math.floor(Date.now() / 1000);
const authorization = {
  from: account.address,
  to: acc.payTo,
  value: acc.amount,
  validAfter: '0',
  validBefore: String(now + 3600),
  nonce: '0x' + randomBytes(32).toString('hex'),
};
const signature = await account.signTypedData({
  domain: { name: 'USD Coin', version: '2', chainId: 8453, verifyingContract: acc.asset },
  types: {
    TransferWithAuthorization: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
    ],
  },
  primaryType: 'TransferWithAuthorization',
  message: {
    from: authorization.from,
    to: authorization.to,
    value: BigInt(authorization.value),
    validAfter: 0n,
    validBefore: BigInt(authorization.validBefore),
    nonce: authorization.nonce,
  },
});

// Step 3: retry the same request with the payment header.
const payload = { x402Version: 2, payload: { signature, authorization }, accepted: acc };
const header = Buffer.from(JSON.stringify(payload)).toString('base64');
const second = await fetch(url, { headers: { 'PAYMENT-SIGNATURE': header } });
console.log('paid status:', second.status);
console.log(JSON.stringify(JSON.parse(await second.text()), null, 2).slice(0, 2000));
