// Dev-only stand-in used when PAYMENT_MOCK_MODE=true: always "succeeds"
// without ever contacting a real processor or moving real money. This lets
// checkout be exercised end-to-end (payment_transactions row, subscription
// activation, UI success state) before any real merchant account exists.
//
// Gated in index.js so it can only ever be reached when PAYMENT_MOCK_MODE is
// explicitly set, and refused outright in production by server.js -- there
// is no path for this to silently fake a real user's payment.

function isConfigured() {
  return true;
}

async function initiateCharge({ txnRefNo, description }) {
  return {
    success: true,
    providerTxnRef: txnRefNo,
    message: `Simulated success (PAYMENT_MOCK_MODE) -- ${description}`,
    raw: { mock: true },
  };
}

export const mockGateway = { isConfigured, initiateCharge };
