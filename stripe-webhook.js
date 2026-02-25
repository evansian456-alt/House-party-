/**
 * Stripe Webhook Handler
 * 
 * Processes Stripe webhooks for subscription lifecycle:
 * - checkout.session.completed
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - invoice.payment_succeeded
 * - invoice.payment_failed
 */

const crypto = require('crypto');
const DEBUG_MODE = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';

/**
 * Verify Stripe webhook signature
 */
function verifyStripeSignature(payload, signature, secret) {
  try {
    const timestamp = signature.split(',')[0].split('=')[1];
    const sig = signature.split(',')[1].split('=')[1];
    
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${payload}`)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
  } catch (error) {
    console.error('[Stripe] Signature verification error:', error.message);
    return false;
  }
}

/**
 * Process Stripe webhook event
 */
async function processStripeWebhook(event, db, referralSystem) {
  const eventType = event.type;
  const data = event.data.object;

  if (DEBUG_MODE) {
    console.log(`[Stripe] Processing webhook: ${eventType}`);
  }

  try {
    switch (eventType) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(data, db, referralSystem);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(data, db);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(data, db);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(data, db);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(data, db);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(data, db);
        break;

      default:
        console.log(`[Stripe] Unhandled event type: ${eventType}`);
    }

    return { success: true };
  } catch (error) {
    console.error(`[Stripe] Error processing webhook ${eventType}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Handle checkout session completed
 */
async function handleCheckoutCompleted(session, db, referralSystem) {
  const userId = session.client_reference_id; // Should be set during checkout
  const customerId = session.customer;
  const subscriptionId = session.subscription;
  const productId = session.metadata?.productId || 'party_pass'; // party_pass or pro_monthly

  if (!userId) {
    console.error('[Stripe] No userId in checkout session');
    return;
  }

  // Store customer ID
  if (db) {
    await db.query(
      `UPDATE users SET stripe_customer_id = $1 WHERE id = $2`,
      [customerId, userId]
    );
  }

  // Grant entitlement
  const expiryDate = new Date();
  if (productId === 'party_pass') {
    // Party Pass: 2 hours from now
    expiryDate.setHours(expiryDate.getHours() + 2);
  } else if (productId === 'pro_monthly') {
    // Pro Monthly: 1 month from now
    expiryDate.setMonth(expiryDate.getMonth() + 1);
  }

  if (db) {
    await db.query(
      `INSERT INTO user_entitlements 
       (user_id, product_id, stripe_subscription_id, granted_at, expires_at) 
       VALUES ($1, $2, $3, NOW(), $4) 
       ON CONFLICT (user_id, product_id) 
       DO UPDATE SET 
         stripe_subscription_id = $3,
         granted_at = NOW(),
         expires_at = $4`,
      [userId, productId, subscriptionId, expiryDate]
    );
  }

  // Mark referral as paid if applicable
  if (referralSystem) {
    await referralSystem.markReferralAsPaid(userId);
  }

  console.log(`[Stripe] Granted ${productId} to user ${userId} (expires: ${expiryDate.toISOString()})`);
}

/**
 * Handle subscription created
 */
async function handleSubscriptionCreated(subscription, db) {
  const customerId = subscription.customer;
  const subscriptionId = subscription.id;
  const status = subscription.status;
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

  if (!db) return;

  // Find user by customer ID
  const userResult = await db.query(
    'SELECT id FROM users WHERE stripe_customer_id = $1',
    [customerId]
  );

  if (userResult.rows.length === 0) {
    console.error(`[Stripe] No user found for customer ${customerId}`);
    return;
  }

  const userId = userResult.rows[0].id;

  // Update entitlement
  await db.query(
    `INSERT INTO user_entitlements 
     (user_id, product_id, stripe_subscription_id, granted_at, expires_at, status) 
     VALUES ($1, 'pro_monthly', $2, NOW(), $3, $4) 
     ON CONFLICT (user_id, product_id) 
     DO UPDATE SET 
       stripe_subscription_id = $2,
       expires_at = $3,
       status = $4`,
    [userId, subscriptionId, currentPeriodEnd, status]
  );

  console.log(`[Stripe] Subscription created for user ${userId}: ${subscriptionId}`);
}

/**
 * Handle subscription updated
 */
async function handleSubscriptionUpdated(subscription, db) {
  const subscriptionId = subscription.id;
  const status = subscription.status;
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

  if (!db) return;

  // Update entitlement status and expiry
  await db.query(
    `UPDATE user_entitlements 
     SET status = $1, expires_at = $2 
     WHERE stripe_subscription_id = $3`,
    [status, currentPeriodEnd, subscriptionId]
  );

  console.log(`[Stripe] Subscription updated: ${subscriptionId} (status: ${status})`);
}

/**
 * Handle subscription deleted/canceled
 */
async function handleSubscriptionDeleted(subscription, db) {
  const subscriptionId = subscription.id;
  const endedAt = new Date(subscription.ended_at * 1000);

  if (!db) return;

  // Mark entitlement as canceled
  await db.query(
    `UPDATE user_entitlements 
     SET status = 'canceled', expires_at = $1 
     WHERE stripe_subscription_id = $2`,
    [endedAt, subscriptionId]
  );

  console.log(`[Stripe] Subscription canceled: ${subscriptionId}`);
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(invoice, db) {
  const subscriptionId = invoice.subscription;
  const amountPaid = invoice.amount_paid / 100; // Convert from smallest unit (cents/pence) to major unit
  const currency = invoice.currency;

  if (!db || !subscriptionId) return;

  // Extend subscription period
  const periodEnd = new Date(invoice.period_end * 1000);

  await db.query(
    `UPDATE user_entitlements 
     SET expires_at = $1, status = 'active' 
     WHERE stripe_subscription_id = $2`,
    [periodEnd, subscriptionId]
  );

  // Track revenue
  const userResult = await db.query(
    `SELECT user_id FROM user_entitlements WHERE stripe_subscription_id = $1`,
    [subscriptionId]
  );

  if (userResult.rows.length > 0) {
    const userId = userResult.rows[0].user_id;
    await db.query(
      `INSERT INTO revenue_metrics 
       (user_id, product_id, amount, currency, stripe_invoice_id, created_at) 
       VALUES ($1, 'pro_monthly', $2, $3, $4, NOW())`,
      [userId, amountPaid, currency, invoice.id]
    );
  }

  console.log(`[Stripe] Payment succeeded for subscription ${subscriptionId}: ${currency.toUpperCase()} ${amountPaid}`);
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice, db) {
  const subscriptionId = invoice.subscription;

  if (!db || !subscriptionId) return;

  // Mark subscription as past_due
  await db.query(
    `UPDATE user_entitlements 
     SET status = 'past_due' 
     WHERE stripe_subscription_id = $1`,
    [subscriptionId]
  );

  console.log(`[Stripe] Payment failed for subscription ${subscriptionId}`);
}

module.exports = {
  verifyStripeSignature,
  processStripeWebhook
};
