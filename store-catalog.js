/**
 * Store Catalog and Item Definitions
 * Defines all purchasable items, prices, and behavior
 */

// Item behavior types
const ITEM_BEHAVIOR = {
  REPLACE: 'replace', // Replaces active selection, never deletes owned (visual packs, titles)
  STACK: 'stack',     // Stacks with other items (profile upgrades, party extensions)
  CONSUMABLE: 'consumable' // Single use item (hype effects)
};

// Store categories
const STORE_CATEGORIES = {
  VISUAL_PACKS: 'visual_pack',
  DJ_TITLES: 'dj_title',
  PROFILE_UPGRADES: 'profile_upgrade',
  PARTY_EXTENSIONS: 'party_extension',
  HYPE_EFFECTS: 'hype_effect',
  SUBSCRIPTIONS: 'subscription'
};

// Visual Packs - Replace active selection, keep all owned
const VISUAL_PACKS = [
  {
    id: 'neon_pack',
    name: 'Neon',
    description: 'Electric neon visuals with pulsing energy',
    price: 3.99, // GBP - DJ visual effects pack (one-time purchase)
    currency: 'GBP',
    type: STORE_CATEGORIES.VISUAL_PACKS,
    behavior: ITEM_BEHAVIOR.REPLACE,
    preview: '🌈',
    permanent: true
  },
  {
    id: 'club_pack',
    name: 'Club',
    description: 'Dark club vibes with strobing lights',
    price: 2.99, // GBP - DJ visual effects pack (one-time purchase)
    currency: 'GBP',
    type: STORE_CATEGORIES.VISUAL_PACKS,
    behavior: ITEM_BEHAVIOR.REPLACE,
    preview: '🎆',
    permanent: true
  },
  {
    id: 'pulse_pack',
    name: 'Pulse',
    description: 'Rhythmic pulse effects synced to the beat',
    price: 3.49, // GBP - DJ visual effects pack (one-time purchase)
    currency: 'GBP',
    type: STORE_CATEGORIES.VISUAL_PACKS,
    behavior: ITEM_BEHAVIOR.REPLACE,
    preview: '💫',
    permanent: true
  }
];

// DJ Titles - Replace active selection, keep all owned
const DJ_TITLES = [
  {
    id: 'rising_title',
    name: 'Rising DJ',
    description: 'Show you\'re on the rise',
    price: 0.99, // GBP - DJ cosmetic title (one-time purchase)
    currency: 'GBP',
    type: STORE_CATEGORIES.DJ_TITLES,
    behavior: ITEM_BEHAVIOR.REPLACE,
    badge: '🌟',
    permanent: true
  },
  {
    id: 'club_title',
    name: 'Club DJ',
    description: 'Certified club favorite',
    price: 1.49, // GBP - DJ cosmetic title (one-time purchase)
    currency: 'GBP',
    type: STORE_CATEGORIES.DJ_TITLES,
    behavior: ITEM_BEHAVIOR.REPLACE,
    badge: '🎵',
    permanent: true
  },
  {
    id: 'superstar_title',
    name: 'Superstar DJ',
    description: 'You\'re a superstar',
    price: 2.49, // GBP - DJ cosmetic title (one-time purchase)
    currency: 'GBP',
    type: STORE_CATEGORIES.DJ_TITLES,
    behavior: ITEM_BEHAVIOR.REPLACE,
    badge: '⭐',
    permanent: true
  },
  {
    id: 'legend_title',
    name: 'Legend DJ',
    description: 'Legendary status achieved',
    price: 3.49, // GBP - DJ cosmetic title (one-time purchase)
    currency: 'GBP',
    type: STORE_CATEGORIES.DJ_TITLES,
    behavior: ITEM_BEHAVIOR.REPLACE,
    badge: '👑',
    permanent: true
  }
];

// Profile Upgrades - Stack with each other
const PROFILE_UPGRADES = [
  {
    id: 'verified_badge',
    name: 'Verified Badge',
    description: 'Blue checkmark next to your name',
    price: 1.99, // GBP - Profile cosmetic upgrade (one-time purchase, stackable)
    currency: 'GBP',
    type: STORE_CATEGORIES.PROFILE_UPGRADES,
    behavior: ITEM_BEHAVIOR.STACK,
    icon: '✓',
    permanent: true
  },
  {
    id: 'crown_effect',
    name: 'Crown Effect',
    description: 'Crown icon above your profile',
    price: 2.99, // GBP - Profile cosmetic upgrade (one-time purchase, stackable)
    currency: 'GBP',
    type: STORE_CATEGORIES.PROFILE_UPGRADES,
    behavior: ITEM_BEHAVIOR.STACK,
    icon: '👑',
    permanent: true
  },
  {
    id: 'animated_name',
    name: 'Animated Name',
    description: 'Your name glows and pulses',
    price: 2.49, // GBP - Profile cosmetic upgrade (one-time purchase, stackable)
    currency: 'GBP',
    type: STORE_CATEGORIES.PROFILE_UPGRADES,
    behavior: ITEM_BEHAVIOR.STACK,
    icon: '✨',
    permanent: true
  },
  {
    id: 'reaction_trail',
    name: 'Reaction Trail',
    description: 'Leave a trail when you react',
    price: 1.99, // GBP - Profile cosmetic upgrade (one-time purchase, stackable)
    currency: 'GBP',
    type: STORE_CATEGORIES.PROFILE_UPGRADES,
    behavior: ITEM_BEHAVIOR.STACK,
    icon: '🌟',
    permanent: true
  }
];

// Party Extensions - Temporary, stack for that party session
const PARTY_EXTENSIONS = [
  {
    id: 'add_30min',
    name: 'Add 30 Minutes',
    description: 'Extend your party by 30 minutes',
    price: 0.99, // GBP - Party session extension (per session, stackable)
    currency: 'GBP',
    type: STORE_CATEGORIES.PARTY_EXTENSIONS,
    behavior: ITEM_BEHAVIOR.STACK,
    duration: 30 * 60, // 30 minutes in seconds
    permanent: false
  },
  {
    id: 'add_5phones',
    name: 'Add 5 Phones',
    description: 'Increase phone limit by 5',
    price: 1.49, // GBP - Party capacity boost (per session, stackable)
    currency: 'GBP',
    type: STORE_CATEGORIES.PARTY_EXTENSIONS,
    behavior: ITEM_BEHAVIOR.STACK,
    phonesAdded: 5,
    permanent: false
  }
];

// Hype Effects - Consumable, single-use party boosters
const HYPE_EFFECTS = [
  {
    id: 'confetti_blast',
    name: 'Confetti Blast',
    description: 'Trigger an epic confetti explosion for all guests',
    price: 0.49, // GBP - Single-use hype effect
    currency: 'GBP',
    type: STORE_CATEGORIES.HYPE_EFFECTS,
    behavior: ITEM_BEHAVIOR.CONSUMABLE,
    icon: '🎊',
    duration: 5, // seconds
    permanent: false
  },
  {
    id: 'laser_show',
    name: 'Laser Show',
    description: 'Activate synchronized laser effects',
    price: 0.99, // GBP - Single-use hype effect
    currency: 'GBP',
    type: STORE_CATEGORIES.HYPE_EFFECTS,
    behavior: ITEM_BEHAVIOR.CONSUMABLE,
    icon: '⚡',
    duration: 10, // seconds
    permanent: false
  },
  {
    id: 'crowd_roar',
    name: 'Crowd Roar',
    description: 'Trigger a massive crowd cheer sound',
    price: 0.79, // GBP - Single-use hype effect
    currency: 'GBP',
    type: STORE_CATEGORIES.HYPE_EFFECTS,
    behavior: ITEM_BEHAVIOR.CONSUMABLE,
    icon: '📣',
    duration: 3, // seconds
    permanent: false
  },
  {
    id: 'fireworks',
    name: 'Fireworks',
    description: 'Launch a spectacular fireworks display',
    price: 1.49, // GBP - Single-use hype effect
    currency: 'GBP',
    type: STORE_CATEGORIES.HYPE_EFFECTS,
    behavior: ITEM_BEHAVIOR.CONSUMABLE,
    icon: '🎆',
    duration: 8, // seconds
    permanent: false
  }
];

// Subscription Tiers
const SUBSCRIPTIONS = [
  {
    id: 'party_pass',
    name: 'Party Pass',
    description: 'Perfect for small parties - 2 hours of fun with messaging',
    price: 3.99, // GBP - Party Pass one-time purchase for 2-hour party session
    currency: 'GBP',
    type: STORE_CATEGORIES.SUBSCRIPTIONS,
    duration: 2 * 60 * 60, // 2 hours in seconds
    maxPhones: 4,
    features: [
      'Up to 4 phones',
      '2 hours duration',
      'Chat + emoji reactions',
      'Guest quick replies',
      'DJ quick message buttons',
      'Auto party prompts',
      'Messages disappear after a few seconds'
    ],
    permanent: false
  },
  {
    id: 'pro_monthly',
    name: 'Pro (Monthly)',
    description: 'Unlimited parties with all features',
    price: 9.99, // GBP - Monthly subscription for unlimited access
    currency: 'GBP',
    type: STORE_CATEGORIES.SUBSCRIPTIONS,
    interval: 'month',
    maxPhones: 10,
    features: [
      'Up to 10 phones',
      'Unlimited time',
      'Custom messages',
      'All reactions',
      'No ads',
      'Priority support',
      'Advanced analytics'
    ],
    permanent: false
  }
];

// All items combined
const ALL_ITEMS = [
  ...VISUAL_PACKS,
  ...DJ_TITLES,
  ...PROFILE_UPGRADES,
  ...PARTY_EXTENSIONS,
  ...HYPE_EFFECTS,
  ...SUBSCRIPTIONS
];

/**
 * Get item by ID
 */
function getItemById(itemId) {
  return ALL_ITEMS.find(item => item.id === itemId);
}

/**
 * Get items by category
 */
function getItemsByCategory(category) {
  return ALL_ITEMS.filter(item => item.type === category);
}

/**
 * Get all store items grouped by category
 */
function getStoreCatalog() {
  return {
    visualPacks: VISUAL_PACKS,
    djTitles: DJ_TITLES,
    profileUpgrades: PROFILE_UPGRADES,
    partyExtensions: PARTY_EXTENSIONS,
    hypeEffects: HYPE_EFFECTS,
    subscriptions: SUBSCRIPTIONS
  };
}

module.exports = {
  ITEM_BEHAVIOR,
  STORE_CATEGORIES,
  VISUAL_PACKS,
  DJ_TITLES,
  PROFILE_UPGRADES,
  PARTY_EXTENSIONS,
  HYPE_EFFECTS,
  SUBSCRIPTIONS,
  ALL_ITEMS,
  getItemById,
  getItemsByCategory,
  getStoreCatalog
};
