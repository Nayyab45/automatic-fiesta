import { createHash } from 'node:crypto';

// EasyPaisa mobile account direct-charge API.
//
// LOWER CONFIDENCE THAN jazzcash.js: unlike JazzCash's integration guide,
// EasyPaisa's request/response field names and exact flow vary by which
// integration mode and merchant tier Telenor Microfinance Bank puts you on
// (their "Open API" REST integration differs from their older
// redirect-based checkout). The shape below follows the field names most
// commonly published for the transactional REST API, but treat every field
// name and endpoint path here as a draft -- confirm each one against the
// actual PDF/API reference EasyPaisa emails you once your merchant
// application is approved, before this is used for a single real charge.
//
// Credentials: EASYPAISA_STORE_ID and EASYPAISA_HASH_KEY come from
// EasyPaisa's merchant onboarding.

const SANDBOX_BASE = 'https://easypaystg.easypaisa.com.pk';
const PRODUCTION_BASE = 'https://easypay.easypaisa.com.pk';

function isConfigured() {
  return !!(process.env.EASYPAISA_STORE_ID && process.env.EASYPAISA_HASH_KEY);
}

function baseUrl() {
  return process.env.EASYPAISA_ENV === 'production' ? PRODUCTION_BASE : SANDBOX_BASE;
}

// EasyPaisa's documented hash recipe: SHA-256 of the request's own fields
// (amount, orderId, storeId, etc.) concatenated with the hash key, verifying
// the request came from this merchant. As with the endpoint paths above,
// confirm the exact field order/format against your merchant documentation.
function requestHash(params, hashKey) {
  const orderedKeys = ['amount', 'storeId', 'orderRefNum', 'transactionType', 'mobileAccountNo'];
  const joined = orderedKeys.map((key) => params[key] ?? '').join('&');
  return createHash('sha256').update(`${joined}&${hashKey}`).digest('hex');
}

async function initiateCharge({ amountPkr, txnRefNo, description, walletPhone }) {
  const storeId = process.env.EASYPAISA_STORE_ID;
  const hashKey = process.env.EASYPAISA_HASH_KEY;

  const params = {
    storeId,
    amount: amountPkr.toFixed(2),
    orderRefNum: txnRefNo,
    transactionType: 'MA', // Mobile Account
    mobileAccountNo: walletPhone,
    emailAddress: '',
    orderDate: new Date().toISOString(),
    desc: description,
  };
  params.encryptedHashRequest = requestHash(params, hashKey);

  const response = await fetch(`${baseUrl()}/easypay-service/rest/v4/initiate-ma-transaction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await response.json();

  return {
    success: data.responseCode === '0000' || data.responseCode === 0,
    providerTxnRef: data.transactionId || txnRefNo,
    message: data.responseDesc || 'No response message from EasyPaisa',
    raw: data,
  };
}

export const easypaisa = { isConfigured, initiateCharge };
