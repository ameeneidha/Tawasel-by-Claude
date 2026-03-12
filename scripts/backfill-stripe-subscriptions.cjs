require('dotenv').config();
const Stripe = require('stripe');
const Database = require('better-sqlite3');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const db = new Database('prisma/dev.db');

const priceToPlan = {
  price_1T9Wo7I1cBVPBGguaxTuXskN: 'STARTER',
  price_1T9WoUI1cBVPBGgu1kSpUzUa: 'GROWTH',
  price_1T9WorI1cBVPBGguvOq6RbCO: 'PRO',
};

async function main() {
  const subscriptions = await stripe.subscriptions.list({ limit: 20, status: 'all' });
  const updateWorkspace = db.prepare(`
    UPDATE Workspace
    SET stripeCustomerId = ?,
        stripeSubscriptionId = ?,
        subscriptionStatus = ?,
        subscriptionCurrentPeriodEnd = ?,
        subscriptionCancelAtPeriodEnd = ?,
        updatedAt = strftime('%s','now') * 1000
    WHERE id = ?
  `);

  for (const subscription of subscriptions.data) {
    const priceId = subscription.items?.data?.[0]?.price?.id;
    const plan = priceToPlan[priceId];
    if (!plan) continue;

    const workspace = db.prepare(`
      SELECT id, name, plan, updatedAt
      FROM Workspace
      WHERE plan = ?
      ORDER BY updatedAt DESC
      LIMIT 1
    `).get(plan);

    if (!workspace) continue;

    updateWorkspace.run(
      typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id || null,
      subscription.id,
      subscription.status,
      subscription.items?.data?.[0]?.current_period_end
        ? subscription.items.data[0].current_period_end * 1000
        : null,
      subscription.cancel_at_period_end ? 1 : 0,
      workspace.id
    );

    console.log(`Backfilled ${workspace.name} (${workspace.id}) with ${subscription.id}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
