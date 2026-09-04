import { jazzcash } from './jazzcash.js';
import { easypaisa } from './easypaisa.js';
import { bankGateway } from './bankGateway.js';
import { mockGateway } from './mockGateway.js';

// Every adapter exposes isConfigured() + initiateCharge(); JazzCash charges
// synchronously and returns a definite success: true/false, while
// bankGateway and easypaisa return success: null and a redirectUrl instead
// (see bankGateway.js) since a hosted-checkout flow can't know the result
// until the customer completes it and the gateway calls back. Only those
// two implement verifyCallback for that reason.
const gateways = {
  jazzcash,
  easypaisa,
  visa: bankGateway,
  bank: bankGateway,
};

// PAYMENT_MOCK_MODE=true routes every payment method type through the
// always-succeeds mock instead, so checkout can be tested end-to-end before
// any real merchant account exists. server.js refuses to start with this set
// in production, so this can't reach real users.
export function getGateway(paymentMethodType) {
  if (process.env.PAYMENT_MOCK_MODE === 'true') {
    return mockGateway;
  }
  return gateways[paymentMethodType] ?? null;
}
