import { createHmac } from 'node:crypto';

// JazzCash Mobile Wallet (MWALLET) direct-charge API.
//
// Credentials come from JazzCash's Merchant Portal after your merchant
// application is approved: pp_MerchantID, pp_Password, and an Integrity
// Salt used to sign every request. This implements the "Purchase/MWALLET"
// flow (charges a JazzCash mobile account directly, no redirect needed) --
// JazzCash also offers a Page Redirection flow for cards, which isn't
// implemented here since the app's saved "jazzcash" payment method is
// always a wallet number.
//
// The request-signing recipe (secureHash below) has been stable across
// JazzCash's integration guide for years, but verify it against the PDF
// your merchant portal gives you before going live -- field names have
// occasionally shifted between integration types.

const SANDBOX_BASE = 'https://sandbox.jazzcash.com.pk';
const PRODUCTION_BASE = 'https://payments.jazzcash.com.pk';

function isConfigured() {
  return !!(process.env.JAZZCASH_MERCHANT_ID && process.env.JAZZCASH_PASSWORD && process.env.JAZZCASH_INTEGRITY_SALT);
}

function baseUrl() {
  return process.env.JAZZCASH_ENV === 'production' ? PRODUCTION_BASE : SANDBOX_BASE;
}

// Every pp_* field (in a fixed, alphabetically-sorted order) has its value
// joined with '&', the integrity salt prepended, and the whole string
// HMAC-SHA256'd using the integrity salt as the key. This is what
// pp_SecureHash proves to JazzCash: that the request actually came from
// this merchant and wasn't tampered with in transit.
function secureHash(params, integritySalt) {
  const sortedKeys = Object.keys(params)
    .filter((key) => key.startsWith('pp_') && params[key] !== undefined && params[key] !== null && params[key] !== '')
    .sort();
  const joined = sortedKeys.map((key) => params[key]).join('&');
  const message = `${integritySalt}&${joined}`;
  return createHmac('sha256', integritySalt).update(message).digest('hex').toUpperCase();
}

function formatDateTime(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

// walletPhone/cnicLast6 identify which JazzCash account to charge.
// cnicLast6 (the last 6 digits of the account holder's CNIC) is required by
// JazzCash's MWALLET API but is deliberately not stored on payment_methods
// -- like a CVV, it's collected fresh at checkout time rather than kept on
// file, since it's more identity-sensitive than a phone number.
async function initiateCharge({ amountPkr, txnRefNo, description, walletPhone, cnicLast6 }) {
  const merchantId = process.env.JAZZCASH_MERCHANT_ID;
  const password = process.env.JAZZCASH_PASSWORD;
  const integritySalt = process.env.JAZZCASH_INTEGRITY_SALT;

  const now = new Date();
  const expiry = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour to complete

  const params = {
    pp_Version: '1.1',
    pp_TxnType: 'MWALLET',
    pp_Language: 'EN',
    pp_MerchantID: merchantId,
    pp_Password: password,
    pp_TxnRefNo: txnRefNo,
    pp_Amount: String(Math.round(amountPkr * 100)), // JazzCash amounts are in paisas
    pp_TxnCurrency: 'PKR',
    pp_TxnDateTime: formatDateTime(now),
    pp_TxnExpiryDateTime: formatDateTime(expiry),
    pp_BillReference: txnRefNo,
    pp_Description: description,
    pp_MobileNumber: walletPhone,
    pp_CNIC: cnicLast6,
  };
  params.pp_SecureHash = secureHash(params, integritySalt);

  const response = await fetch(`${baseUrl()}/ApplicationAPI/API/2.0/Purchase/MWALLET`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await response.json();

  return {
    // "000" is JazzCash's documented success code for this endpoint.
    success: data.pp_ResponseCode === '000',
    providerTxnRef: data.pp_TxnRefNo || txnRefNo,
    message: data.pp_ResponseMessage || 'No response message from JazzCash',
    raw: data,
  };
}

export const jazzcash = { isConfigured, initiateCharge };
