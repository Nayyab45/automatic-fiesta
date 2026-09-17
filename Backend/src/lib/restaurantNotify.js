// Notifies a restaurant by email/SMS when someone books seats there through
// the app (see tablesRouter.post('/') in routes/tables.js). Best-effort and
// never throws, same as sendPushToUser in push.js -- a delivery failure
// (provider not configured, network hiccup, bad contact info) must never
// break the booking request that triggered it.
import { mailer } from './mailer.js';
import { sms } from './sms.js';

function smsBody({ hostName, restaurantName, seatsTotal, gatheringType, dateTime }) {
  const when = new Date(dateTime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  return `What Should We Eat: ${hostName} booked ${seatsTotal} seat${seatsTotal === 1 ? '' : 's'} (${gatheringType}) at ${restaurantName} for ${when}.`;
}

export async function notifyRestaurantOfBooking(restaurant, booking) {
  const jobs = [];

  if (restaurant.contact_email && mailer.isConfigured()) {
    jobs.push(
      mailer.sendBookingNotificationEmail({ to: restaurant.contact_email, restaurantName: restaurant.name, ...booking }),
    );
  }

  if (restaurant.contact_phone && sms.isConfigured()) {
    jobs.push(sms.sendSms({ to: restaurant.contact_phone, body: smsBody({ restaurantName: restaurant.name, ...booking }) }));
  }

  if (!jobs.length) return;

  const results = await Promise.allSettled(jobs);
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[restaurantNotify] failed to notify restaurant of booking:', result.reason?.message);
    }
  }
}
