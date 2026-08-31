import { jazzcash } from './jazzcash.js';
import { easypaisa } from './easypaisa.js';
import { bankGateway } from './bankGateway.js';

// Every adapter exposes isConfigured() + initiateCharge(); the wallet
// adapters (JazzCash/EasyPaisa) charge synchronously and return a definite
// success: true/false, while bankGateway returns success: null and a
// redirectUrl instead (see bankGateway.js) since a hosted-checkout flow
// can't know the result until the customer completes it and the gateway
// calls back. Only bankGateway implements verifyCallback for that reason.
const gateways = {
  jazzcash,
  easypaisa,
  visa: bankGateway,
  bank: bankGateway,
};

export function getGateway(paymentMethodType) {
  return gateways[paymentMethodType] ?? null;
}
