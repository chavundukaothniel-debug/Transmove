import { executeTrustedOperation } from '../netlify/functions/trusted-api.js';

async function test() {
  console.log('Testing public action: list_payment_destinations...');
  const dests = await executeTrustedOperation({ action: 'list_payment_destinations' });
  console.log('Payment destinations count:', dests.destinations?.length);

  console.log('Testing public action: list_subscription_plans...');
  const plans = await executeTrustedOperation({ action: 'list_subscription_plans' });
  console.log('Subscription plans count:', plans.plans?.length);

  console.log('Testing public action: list_ad_rate_cards...');
  const cards = await executeTrustedOperation({ action: 'list_ad_rate_cards' });
  console.log('Ad rate cards count:', cards.rate_cards?.length);

  console.log('Testing public action: calculate_ad_price (homepage_banner, 7 days)...');
  const price = await executeTrustedOperation({
    action: 'calculate_ad_price',
    data: { placement: 'homepage_banner', duration_days: 7, is_targeted: true, is_featured: false }
  });
  console.log('Calculated price:', price);
}

test().then(() => console.log('PASS: trusted-api EcoCash actions initialized properly!')).catch(e => {
  console.error('FAIL:', e);
  process.exit(1);
});
