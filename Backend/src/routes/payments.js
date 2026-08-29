import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { toCamelRows } from '../lib/serialize.js';
import { requireFields, isOneOf } from '../lib/validate.js';

export const paymentMethodsRouter = Router();

paymentMethodsRouter.use(requireAuth);

const TYPES = ['visa', 'bank', 'easypaisa', 'jazzcash'];

function maskPhone(phone) {
  const digits = String(phone).replace(/\D/g, '');
  return digits.length >= 4 ? `${digits.slice(0, -4).replace(/\d/g, '•')}${digits.slice(-4)}` : phone;
}

// Builds the display label server-side (rather than trusting a
// client-supplied string) so it can't drift from the underlying data and
// stays consistent everywhere the method is shown, the same reasoning
// notifications' formatNotification() and matches' scoring reasons follow.
function labelFor(row) {
  switch (row.type) {
    case 'visa':
      return `Visa •••• ${row.last4}`;
    case 'bank':
      return `${row.bank_name} •••• ${row.last4}`;
    case 'easypaisa':
      return `EasyPaisa ${maskPhone(row.wallet_phone)}`;
    case 'jazzcash':
      return `JazzCash ${maskPhone(row.wallet_phone)}`;
    default:
      return 'Payment method';
  }
}

function serialize(row) {
  const camel = toCamelRows([row])[0];
  return { ...camel, isDefault: !!row.is_default, label: labelFor(row) };
}

function listFor(userId) {
  const rows = db.prepare('SELECT * FROM payment_methods WHERE user_id = ? ORDER BY created_at ASC').all(userId);
  return rows.map(serialize);
}

paymentMethodsRouter.get('/', (req, res) => {
  res.json({ paymentMethods: listFor(req.user.sub) });
});

paymentMethodsRouter.post('/', (req, res) => {
  const { type } = req.body ?? {};
  if (!isOneOf(type, TYPES)) {
    return res.status(400).json({ message: `type must be one of: ${TYPES.join(', ')}` });
  }

  let missingFieldsError;
  const fields = {
    lastFour: null,
    expiryMonth: null,
    expiryYear: null,
    cardholderName: null,
    bankName: null,
    accountTitle: null,
    walletPhone: null,
  };

  if (type === 'visa') {
    missingFieldsError = requireFields(req.body, ['last4', 'expiryMonth', 'expiryYear', 'cardholderName']);
    fields.lastFour = req.body.last4;
    fields.expiryMonth = req.body.expiryMonth;
    fields.expiryYear = req.body.expiryYear;
    fields.cardholderName = req.body.cardholderName;
  } else if (type === 'bank') {
    missingFieldsError = requireFields(req.body, ['bankName', 'accountTitle', 'last4']);
    fields.bankName = req.body.bankName;
    fields.accountTitle = req.body.accountTitle;
    fields.lastFour = req.body.last4;
  } else {
    missingFieldsError = requireFields(req.body, ['walletPhone']);
    fields.walletPhone = req.body.walletPhone;
    fields.accountTitle = req.body.accountTitle ?? null;
  }

  if (missingFieldsError) {
    return res.status(400).json({ message: missingFieldsError });
  }
  if (String(fields.lastFour ?? '').length > 4) {
    return res.status(400).json({ message: 'last4 must be at most 4 digits -- send only the last 4, never a full number' });
  }

  const isFirst = db.prepare('SELECT COUNT(*) as count FROM payment_methods WHERE user_id = ?').get(req.user.sub).count === 0;

  const result = db
    .prepare(
      `INSERT INTO payment_methods
       (user_id, type, last4, expiry_month, expiry_year, cardholder_name, bank_name, account_title, wallet_phone, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      req.user.sub,
      type,
      fields.lastFour,
      fields.expiryMonth,
      fields.expiryYear,
      fields.cardholderName,
      fields.bankName,
      fields.accountTitle,
      fields.walletPhone,
      isFirst ? 1 : 0,
    );

  const created = db.prepare('SELECT * FROM payment_methods WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ paymentMethod: serialize(created) });
});

paymentMethodsRouter.put('/:id/default', (req, res) => {
  const method = db.prepare('SELECT id FROM payment_methods WHERE id = ? AND user_id = ?').get(req.params.id, req.user.sub);
  if (!method) {
    return res.status(404).json({ message: 'Payment method not found' });
  }
  db.prepare('UPDATE payment_methods SET is_default = 0 WHERE user_id = ?').run(req.user.sub);
  db.prepare('UPDATE payment_methods SET is_default = 1 WHERE id = ?').run(method.id);
  res.json({ paymentMethods: listFor(req.user.sub) });
});

paymentMethodsRouter.delete('/:id', (req, res) => {
  const method = db.prepare('SELECT * FROM payment_methods WHERE id = ? AND user_id = ?').get(req.params.id, req.user.sub);
  if (!method) {
    return res.status(404).json({ message: 'Payment method not found' });
  }
  db.prepare('DELETE FROM payment_methods WHERE id = ?').run(method.id);

  if (method.is_default) {
    const next = db.prepare('SELECT id FROM payment_methods WHERE user_id = ? ORDER BY created_at ASC LIMIT 1').get(req.user.sub);
    if (next) {
      db.prepare('UPDATE payment_methods SET is_default = 1 WHERE id = ?').run(next.id);
    }
  }

  res.json({ paymentMethods: listFor(req.user.sub) });
});
