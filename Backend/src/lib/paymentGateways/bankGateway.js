import { createHmac } from 'node:crypto';

// Generic hosted-checkout adapter for the 'visa' and 'bank' payment method
// types.
//
// Unlike JazzCash/EasyPaisa, there is no single "Pakistani bank API" --
// card and bank-transfer payments in Pakistan go through an aggregator
// (1Link's e-commerce gateway, PayFast Pakistan, Safepay, or a specific
// bank's own gateway) that a merchant contracts with separately. This
// implements the shape virtually all of them share -- build a signed
// request, redirect the customer to a hosted payment page, verify a signed
// callback when they return -- so switching in a real one later is a matter
// of confirming field names and endpoints against whichever aggregator gets
// chosen, not restructuring this flow.
//
// Credentials (placeholder names): BANK_GATEWAY_MERCHANT_ID,
// BANK_GATEWAY_SECRET, BANK_GATEWAY_BASE_URL -- set these once a specific
// provider is selected.

function isConfigured() {
  return !!(process.env.BANK_GATEWAY_MERCHANT_ID && process.env.BANK_GATEWAY_SECRET && process.env.BANK_GATEWAY_BASE_URL);
}

function signParams(params, secret) {
  const sortedKeys = Object.keys(params).sort();
  const joined = sortedKeys.map((key) => `${key}=${params[key]}`).join('&');
  return createHmac('sha256', secret).update(joined).digest('hex');
}

// Hosted-checkout flow: rather than charging synchronously like the wallet
// adapters, this returns a redirectUrl for the client to send the customer
// to. The gateway itself collects card/bank details on its own page (so
// this app never touches a full card number or bank PIN) and redirects back
// to returnUrl, where verifyCallback below confirms the result.
async function initiateCharge({ amountPkr, txnRefNo, description, returnUrl }) {
  const merchantId = process.env.BANK_GATEWAY_MERCHANT_ID;
  const secret = process.env.BANK_GATEWAY_SECRET;

  const params = {
    merchant_id: merchantId,
    amount: amountPkr.toFixed(2),
    currency: 'PKR',
    order_ref: txnRefNo,
    description,
    return_url: returnUrl,
  };
  const signature = signParams(params, secret);

  const redirectUrl = `${process.env.BANK_GATEWAY_BASE_URL}/checkout?${new URLSearchParams({ ...params, signature })}`;

  return {
    success: null, // Not known yet -- the customer still has to complete checkout on the gateway's page.
    redirectUrl,
    providerTxnRef: txnRefNo,
    message: 'Redirect to hosted checkout',
    raw: params,
  };
}

// Called from the callback route once the customer returns from the
// gateway's hosted page. Recomputes the signature over every field the
// gateway sent back (minus its own signature field) and compares it to what
// was provided, rejecting anything that doesn't match -- exactly like
// JazzCash's pp_SecureHash, just on the response side instead of the
// request side.
function verifyCallback(payload) {
  const secret = process.env.BANK_GATEWAY_SECRET;
  const { signature, ...fields } = payload;
  const expected = signParams(fields, secret);
  return {
    valid: signature === expected,
    success: fields.status === 'success' || fields.status === 'succeeded',
    providerTxnRef: fields.order_ref,
    message: fields.message || (fields.status === 'success' ? 'Payment succeeded' : 'Payment failed'),
    raw: fields,
  };
}

export const bankGateway = { isConfigured, initiateCharge, verifyCallback };
