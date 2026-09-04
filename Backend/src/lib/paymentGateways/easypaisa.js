import { createCipheriv } from 'node:crypto';

// EasyPaisa hosted-checkout (redirect) flow.
//
// Rewritten 2026-09-02 against a real open-source reference implementation
// (github.com/zfhassaan/easypaisa, a published Laravel package -- MIT-style
// PHP source, not EasyPaisa's own docs) after the original version here
// turned out to guess wrong on two real points: it used SHA-256 for the
// hash (the real scheme is AES-128-ECB) and modeled this as a synchronous
// direct-charge API when EasyPaisa's checkout is actually a hosted-page
// redirect, same shape as bankGateway.js. Base URLs are corroborated by
// multiple independent third-party integrations (nopCommerce, a Django
// tutorial, a WooCommerce plugin), so those are higher-confidence than the
// rest. Still not official documentation -- confirm against the PDF/API
// reference EasyPaisa emails once a merchant application is approved,
// especially whether the checkout URL expects this GET-with-querystring
// form (what the reference implementation does) or an HTML form POST (what
// some third-party write-ups describe) -- this implements the former.
//
// Credentials: EASYPAISA_STORE_ID and EASYPAISA_HASH_KEY, from EasyPaisa's
// OPS Portal (profile page for Store ID, Account Settings > Generate
// Hashkey for the hash key).

const SANDBOX_BASE = 'https://easypaystg.easypaisa.com.pk/easypay/Index.jsf';
const PRODUCTION_BASE = 'https://easypay.easypaisa.com.pk/easypay/Index.jsf';

function isConfigured() {
  return !!(process.env.EASYPAISA_STORE_ID && process.env.EASYPAISA_HASH_KEY);
}

function baseUrl() {
  return process.env.EASYPAISA_ENV === 'production' ? PRODUCTION_BASE : SANDBOX_BASE;
}

function karachiTimestamp() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
}

// AES-128-ECB (PKCS7 padding -- the OpenSSL default the reference relies on)
// of a fixed query string, base64-encoded. AES-128 needs an exact 16-byte
// key; PHP's openssl_encrypt silently zero-pads/truncates a mismatched key
// length rather than erroring, so this does the same instead of throwing on
// a hash key that isn't exactly 16 bytes.
function requestHash({ amount, orderRefNum, postBackURL, storeId, timeStamp }, hashKey) {
  const query = `amount=${amount}&orderRefNum=${orderRefNum}&paymentMethod=InitialRequest&postBackURL=${postBackURL}&storeId=${storeId}&timeStamp=${timeStamp}`;
  const key = Buffer.alloc(16);
  Buffer.from(hashKey, 'utf8').copy(key, 0, 0, 16);
  const cipher = createCipheriv('aes-128-ecb', key, null);
  return Buffer.concat([cipher.update(query, 'utf8'), cipher.final()]).toString('base64');
}

// Hosted-checkout flow: build a signed redirect URL and send the customer
// there. EasyPaisa collects the mobile account / card details on its own
// page and redirects back to returnUrl, where verifyCallback below reads
// the result.
async function initiateCharge({ amountPkr, txnRefNo, returnUrl }) {
  const storeId = process.env.EASYPAISA_STORE_ID;
  const hashKey = process.env.EASYPAISA_HASH_KEY;
  const amount = amountPkr.toFixed(2);
  const timeStamp = karachiTimestamp();

  const encryptedHashRequest = requestHash(
    { amount, orderRefNum: txnRefNo, postBackURL: returnUrl, storeId, timeStamp },
    hashKey,
  );

  const params = new URLSearchParams({
    storeId,
    orderId: txnRefNo,
    transactionAmount: amount,
    mobileAccountNo: '',
    emailAddress: '',
    transactionType: 'InitialRequest',
    tokenExpiry: '',
    bankIdentificationNumber: '',
    encryptedHashRequest,
    merchantPaymentMethod: '',
    postBackURL: returnUrl,
    signature: '',
  });

  return {
    success: null, // Not known yet -- the customer still has to complete checkout on EasyPaisa's page.
    redirectUrl: `${baseUrl()}?${params}`,
    providerTxnRef: txnRefNo,
    message: 'Redirect to hosted checkout',
    raw: Object.fromEntries(params),
  };
}

// Unlike JazzCash/bankGateway, the reference implementation this was built
// from doesn't verify a signature on the way back -- EasyPaisa's postback
// isn't confirmed to carry one at all. Treat this as advisory only until a
// real merchant integration doc says otherwise; `valid` is always true here
// because there is nothing to check it against yet.
function verifyCallback(payload) {
  return {
    valid: true,
    success: payload.status === 'success' || payload.responseCode === '0000' || payload.status === '0000',
    providerTxnRef: payload.orderId || payload.orderRefNum,
    message: payload.desc || payload.responseDesc || 'No status message from EasyPaisa',
    raw: payload,
  };
}

export const easypaisa = { isConfigured, initiateCharge, verifyCallback };
