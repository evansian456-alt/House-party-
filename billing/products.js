/**
 * billing/products.js
 * Server-side product catalog.
 * Single source of truth for all purchasable products across platforms.
 */

'use strict';

const PRODUCTS = {
  party_pass: {
    key: 'party_pass',
    type: 'one_time',
    stripe: {
      priceId: process.env.STRIPE_PRICE_ID_PARTY_PASS || 'price_1T730tK3GhmyOKSB36mifw84'
    },
    apple: {
      productId: 'com.houseparty.partypass'
    },
    google: {
      productId: 'com.houseparty.partypass'
    },
    entitlement: {
      tier: 'PARTY_PASS'
    }
  },
  pro_monthly: {
    key: 'pro_monthly',
    type: 'subscription',
    stripe: {
      priceId: process.env.STRIPE_PRICE_ID_PRO_MONTHLY || 'price_1T733rK3GhmyOKSBsghjQPUZ'
    },
    apple: {
      productId: 'com.houseparty.pro.monthly'
    },
    google: {
      productId: 'com.houseparty.pro.monthly'
    },
    entitlement: {
      tier: 'PRO'
    }
  }
};

/**
 * Get product by key.
 * @param {string} key - product key (e.g. 'party_pass', 'pro_monthly')
 * @returns {object|null}
 */
function getProduct(key) {
  return PRODUCTS[key] || null;
}

/**
 * Find a product by its platform-specific productId.
 * @param {string} provider - 'apple' | 'google'
 * @param {string} productId
 * @returns {object|null}
 */
function getProductByPlatformId(provider, productId) {
  for (const product of Object.values(PRODUCTS)) {
    if (product[provider] && product[provider].productId === productId) {
      return product;
    }
  }
  return null;
}

module.exports = { PRODUCTS, getProduct, getProductByPlatformId };
