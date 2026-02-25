# Add-ons User Guide - Complete Explanation

Welcome to the complete guide to Phone Party add-ons! This document explains everything you need to know about the optional add-ons available to enhance your party experience.

## 📋 Table of Contents
1. [What Are Add-ons?](#what-are-add-ons)
2. [How to Purchase Add-ons](#how-to-purchase-add-ons)
3. [Visual Packs](#visual-packs)
4. [Profile Upgrades](#profile-upgrades)
5. [DJ Titles](#dj-titles)
6. [Party Extensions](#party-extensions)
7. [Hype Effects](#hype-effects)
8. [Frequently Asked Questions](#frequently-asked-questions)

---

## What Are Add-ons?

Add-ons are **optional upgrades** that enhance your Phone Party experience with special effects, cosmetic upgrades, and party boosters. They are **not required** to use Phone Party - all core features (syncing phones, music playback, reactions) work perfectly without them.

Add-ons fall into 5 categories:
- **Visual Packs** 🎨 - DJ visual effects for the party
- **Profile Upgrades** ✨ - Cosmetic enhancements to your profile
- **DJ Titles** 🎧 - Special badges to show your DJ status
- **Party Extensions** ⚡ - Boost party duration or phone capacity
- **Hype Effects** 🔥 - Single-use party moments (confetti, lasers, etc.)

### How to Access Add-ons

You can access the add-ons store from multiple places:

1. **Landing Page** - Click the golden "✨ ADD-ONS (BOOST YOUR PARTY)" button
2. **DJ View** - While hosting a party, click the "Add-ons" button in your controls
3. **Guest View** - While in a party as a guest, click the "Add-ons" button

All three paths take you to the **Upgrade Hub**, where you can browse all 5 categories.

---

## How to Purchase Add-ons

### Purchase Process

1. **Browse** - Navigate to the Upgrade Hub and select a category (e.g., Visual Packs)
2. **Choose an Item** - Review the items, prices, and descriptions
3. **Click "BUY"** - Press the BUY button on the item you want
4. **Confirm Purchase** - A checkout modal appears showing the item name and price
5. **Complete Payment** - Confirm the purchase (currently simulated for demo purposes)
6. **Instant Activation** - The item is immediately added to your account

### What Happens When You Pay?

When you successfully purchase an add-on:

✅ **Payment Processed** - Your payment is processed through the payment provider (Stripe in production, currently simulated)

✅ **Item Unlocked** - The add-on is immediately added to your account

✅ **State Updated** - Your purchase is saved in both:
- Client-side (localStorage for instant access)
- Server-side (PostgreSQL database for permanent storage)

✅ **UI Updates** - The store interface updates to show your new purchase:
- "BUY" button changes to "Set Active" or "OWNED"
- Item becomes available for use

✅ **Confirmation** - You receive a success notification

### Payment Details

- **Currency**: All prices are in GBP (£)
- **Payment Methods**: Credit/debit cards via Stripe (production), Google Pay/Apple Pay (native apps)
- **Security**: All payment data is handled securely by payment providers (no card details stored on servers)
- **Receipts**: Transaction records are stored in your purchase history

---

## Visual Packs

### What Are Visual Packs? 🎨

Visual Packs are **DJ-only** visual effects that enhance the party atmosphere. When you activate a visual pack, all phones in the party display coordinated visual effects that match the music's energy and beat.

### How They Work

- **One-Time Purchase**: Buy once, own forever
- **REPLACE Behavior**: Only one visual pack can be active at a time
- **DJ Control**: Only the party host (DJ) can activate visual packs
- **Party-Wide Effect**: All phones in the party see the active visual pack

### Available Visual Packs

| Pack Name | Price | Description | Preview |
|-----------|-------|-------------|---------|
| **Neon** | £3.99 | Electric neon visuals with pulsing energy | 🌈 |
| **Club** | £2.99 | Dark club vibes with strobing lights | 🎆 |
| **Pulse** | £3.49 | Rhythmic pulse effects synced to the beat | 💫 |

### What Happens When You Buy a Visual Pack?

1. **Purchase Completed** ✅
   - Pack is added to your owned collection
   - Available in your Visual Packs store

2. **Activation**
   - Navigate to Visual Packs store
   - Click "Set Active" on any owned pack
   - Visual effects immediately appear on all phones in the party

3. **Switching Packs**
   - You can switch between owned packs at any time
   - Activating a different pack deactivates the current one
   - All owned packs remain in your collection forever

### Example Use Case

**Scenario**: You're hosting a chill party that transitions to high energy.

1. Start party with **Pulse Pack** (rhythmic, moderate energy)
2. Switch to **Neon Pack** when energy picks up (bright, exciting)
3. End with **Club Pack** for peak dance moments (dark, strobing)

You own all three packs, so switching is instant and free!

---

## Profile Upgrades

### What Are Profile Upgrades? ✨

Profile Upgrades are **cosmetic enhancements** that make your profile stand out in any party. Unlike visual packs, these are personal to you and visible in all parties you join.

### How They Work

- **One-Time Purchase**: Buy once, own forever
- **STACK Behavior**: All purchased upgrades apply simultaneously
- **Always Active**: No need to activate/deactivate - they're always on
- **Personal**: Only visible on your profile (not party-wide)
- **Works Everywhere**: Active in any party you join, as DJ or guest

### Available Profile Upgrades

| Upgrade Name | Price | Description | Icon |
|--------------|-------|-------------|------|
| **Verified Badge** | £1.99 | Blue checkmark next to your name | ✓ |
| **Crown Effect** | £2.99 | Crown icon above your profile | 👑 |
| **Animated Name** | £2.49 | Your name glows and pulses | ✨ |
| **Reaction Trail** | £1.99 | Leave a trail when you react | 🌟 |

### What Happens When You Buy a Profile Upgrade?

1. **Purchase Completed** ✅
   - Upgrade is immediately added to your profile
   - No activation needed - it's automatic

2. **Stacking**
   - Purchase multiple upgrades and they all display together
   - Example: Verified Badge + Crown Effect + Animated Name all show at once

3. **Permanent**
   - Upgrades are permanent and always active
   - Visible in every party you join
   - Cannot be disabled (always on)

### Example Use Case

**Scenario**: You want to build your DJ brand and stand out.

1. Start with **Verified Badge** (£1.99) for credibility
2. Add **Animated Name** (£2.49) to catch attention
3. Complete with **Crown Effect** (£2.99) for premium status
4. Finally add **Reaction Trail** (£1.99) for maximum flair

**Total Investment**: £9.46 for a fully upgraded, eye-catching profile that works in every party!

---

## DJ Titles

### What Are DJ Titles? 🎧

DJ Titles are **special badges** that appear next to your name, showing your DJ status and style. Think of them as achievements or ranks that you can display.

### How They Work

- **One-Time Purchase**: Buy once, own forever
- **REPLACE Behavior**: Only one title can be active at a time
- **Manual Activation**: You choose which title to display
- **Visible to All**: Appears next to your name in parties
- **Collection**: You can collect all titles and switch between them

### Available DJ Titles

| Title Name | Price | Description | Badge |
|------------|-------|-------------|-------|
| **Rising DJ** | £0.99 | Show you're on the rise | 🌟 |
| **Club DJ** | £1.49 | Certified club favorite | 🎵 |
| **Superstar DJ** | £2.49 | You're a superstar | ⭐ |
| **Legend DJ** | £3.49 | Legendary status achieved | 👑 |

### What Happens When You Buy a DJ Title?

1. **Purchase Completed** ✅
   - Title is added to your owned collection
   - Available in your DJ Titles store

2. **Activation**
   - Navigate to DJ Titles store
   - Click "Activate" on any owned title
   - Title immediately appears next to your name

3. **Switching Titles**
   - Change your active title anytime
   - Match your title to the party vibe
   - All owned titles remain in your collection forever

### Title Progression (Optional Path)

While you can buy any title in any order, many DJs like to progress through the ranks:

1. **Rising DJ** (£0.99) - Getting started
2. **Club DJ** (£1.49) - Regular performer
3. **Superstar DJ** (£2.49) - Established reputation
4. **Legend DJ** (£3.49) - Ultimate status

**Total Investment**: £9.46 to own all four titles and switch between them based on context.

### Example Use Case

**Scenario**: You want to match your title to different party contexts.

- **Rising DJ** - For casual friend gatherings (humble vibe)
- **Club DJ** - For regular weekend parties (professional vibe)
- **Superstar DJ** - For special events (confident vibe)
- **Legend DJ** - For your biggest parties (legendary vibe)

---

## Party Extensions

### What Are Party Extensions? ⚡

Party Extensions are **temporary boosters** that extend your current party session. They're perfect when you need more time or more phones than your subscription tier allows.

### How They Work

- **Per-Session Purchase**: Buy when you need them
- **STACK Behavior**: Multiple extensions stack together
- **Immediate Effect**: Applied instantly to your current party
- **Temporary**: Only last for the current party session
- **Non-Permanent**: Each new party requires new extensions if needed

### Available Party Extensions

| Extension Name | Price | Description | Benefit |
|----------------|-------|-------------|---------|
| **Add 30 Minutes** | £0.99 | Extend your party by 30 minutes | +30 min duration |
| **Add 5 Phones** | £1.49 | Increase phone limit by 5 | +5 phone capacity |

### What Happens When You Buy a Party Extension?

1. **Purchase Completed** ✅
   - Extension is applied immediately to your current party
   - Party timer or phone limit updates instantly

2. **Stacking**
   - Buy multiple time extensions: 2 × 30min = 1 hour extra
   - Buy multiple phone extensions: 2 × 5 phones = 10 extra phones
   - Mix and match as needed

3. **Session-Based**
   - Extensions only last for the current party
   - New party = need new extensions if desired
   - Allows flexible, pay-as-you-go party boosting

### Tier Comparison & When to Use Extensions

| Tier | Max Phones | Duration | Monthly Cost | When to Extend |
|------|------------|----------|--------------|----------------|
| **Free** | 2 | Limited | £0 | Always - free tier is very limited |
| **Party Pass** | 4 | 2 hours | £3.99 (one-time) | When 2 hours isn't enough or need >4 phones |
| **Pro Monthly** | 10 | Unlimited | £9.99/month | When need >10 phones temporarily |

### Example Use Cases

**Use Case 1: Extended Party**
- You have Party Pass (2 hours, 4 phones)
- Party is going great after 2 hours
- Buy 2 × "Add 30 Minutes" (£1.98 total) for 1 extra hour
- Party continues for 3 hours total!

**Use Case 2: Extra Guests**
- You have Party Pass (2 hours, 4 phones)
- 7 friends want to join (need 8 phones total)
- Buy 1 × "Add 5 Phones" (£1.49) to increase capacity from 4 to 9 phones
- Everyone can join!

**Use Case 3: Big Event**
- You have Pro Monthly (10 phones, unlimited time)
- Hosting a 15-person party (need 16 phones total)
- Buy 2 × "Add 5 Phones" (£2.98) to go from 10 to 20 phone capacity
- One-time expense for a special occasion

### Cost Comparison

**Scenario**: You host parties occasionally (2-3 times per month)

**Option A: Pro Monthly**
- £9.99/month × 12 months = £119.88/year
- Best if you party frequently

**Option B: Party Pass + Extensions**
- Party Pass: £3.99 per party
- Extensions: £2-3 per party average
- 3 parties/month = ~£21/month = £252/year
- More expensive for frequent use

**Option C: Free + Extensions**
- Extensions only: £3-5 per party
- 3 parties/month = ~£12/month = £144/year
- Budget option if parties are under 2 hours

**Recommendation**: 
- **1-2 parties/month** → Free + Extensions (£144/year)
- **3-4 parties/month** → Party Pass + occasional extensions (£170-200/year)
- **5+ parties/month or longer parties** → Pro Monthly (£120/year)

---

## Hype Effects

### What Are Hype Effects? 🔥

Hype Effects are **single-use, consumable moments** that create epic, party-wide effects. Think of them as "magic tricks" you can pull out at peak moments to energize the crowd.

### How They Work

- **Consumable**: Each purchase = 1 use (like buying fireworks)
- **Single-Use**: Each effect is consumed when triggered
- **Quantity Tracking**: Buy multiple and your quantity increases
- **DJ Trigger**: Only the party host can trigger hype effects
- **Party-Wide**: All phones in the party experience the effect simultaneously

### Available Hype Effects

| Effect Name | Price | Description | Duration | Icon |
|-------------|-------|-------------|----------|------|
| **Confetti Blast** | £0.49 | Epic confetti explosion for all guests | 5 seconds | 🎊 |
| **Laser Show** | £0.99 | Synchronized laser effects | 10 seconds | ⚡ |
| **Crowd Roar** | £0.79 | Massive crowd cheer sound | 3 seconds | 📣 |
| **Fireworks** | £1.49 | Spectacular fireworks display | 8 seconds | 🎆 |

### What Happens When You Buy a Hype Effect?

1. **Purchase Completed** ✅
   - Effect quantity increases by 1
   - Example: Own 3 × Confetti Blast

2. **Inventory Tracking**
   - Hype Effects store shows your quantities
   - Example: "Confetti Blast (×3)" means you have 3 uses

3. **Triggering Effects**
   - As DJ, open Hype Effects store
   - Click "USE" on any owned effect
   - Effect triggers instantly across all phones
   - Quantity decreases by 1

4. **Restocking**
   - Buy more at any time
   - No limit on quantity
   - Stock up before big parties!

### Strategic Use of Hype Effects

**The 5-Stage Party Arc** (and when to trigger effects):

1. **Opening (0-15 min)** - People arriving, warming up
   - *No effects yet - save them*

2. **Building Energy (15-45 min)** - Dance floor filling up
   - *Confetti Blast* (£0.49) - Get people excited

3. **Peak Energy (45-75 min)** - Everyone's dancing
   - *Laser Show* (£0.99) - Maximize the peak
   - *Fireworks* (£1.49) - Epic peak moment

4. **Sustained Energy (75-105 min)** - Keeping it going
   - *Crowd Roar* (£0.79) - Re-energize when momentum dips

5. **Grand Finale (Last 10 min)** - Ending on a high
   - *Fireworks* (£1.49) - Send everyone home happy

**Total Investment**: £5.15 for a perfectly orchestrated 2-hour party with 5 epic moments.

### Example Budget Scenarios

**Budget Party (1 effect) - £0.49-£1.49**
- Choose your single best moment
- Trigger at peak energy
- Maximum impact for minimum cost

**Standard Party (3 effects) - £2.27-£3.97**
- Opening hype (Confetti Blast)
- Peak moment (Laser Show or Fireworks)
- Grand finale (Crowd Roar or Fireworks)

**Premium Party (5+ effects) - £5+**
- Full strategic deployment across all 5 party stages
- Multiple peak moments
- Memorable, high-energy experience

**Event Party (10+ effects) - £10+**
- Major events (birthdays, graduations, etc.)
- Effects at every major moment
- Professional-level party production

### Bulk Buying Strategy

Buy in bulk before a big party:

**Pre-Party Shopping List Example**:
- 3 × Confetti Blast (£1.47) - Opening, mid-party, finale
- 2 × Laser Show (£1.98) - Peak moments
- 2 × Crowd Roar (£1.58) - Energy boosters
- 3 × Fireworks (£4.47) - Special moments
- **Total: £9.50** for a fully stocked effects arsenal

Then use strategically throughout the party - you've got 10 epic moments ready to deploy!

---

## Frequently Asked Questions

### General Questions

**Q: Do I need to buy add-ons to use Phone Party?**

A: No! Add-ons are 100% optional. All core features (syncing phones, music playback, guest reactions, DJ controls) work perfectly without any add-ons.

**Q: Can I get refunds on add-ons?**

A: Permanent add-ons (Visual Packs, DJ Titles, Profile Upgrades) generally cannot be refunded after purchase. Party Extensions and Hype Effects are non-refundable as they are consumed/used immediately. Contact support for exceptional cases.

**Q: Do add-ons work across all my parties?**

A: Permanent add-ons (Visual Packs, DJ Titles, Profile Upgrades) work in all parties, forever. Party Extensions only apply to the current session. Hype Effects can be used in any party until consumed.

**Q: Can guests buy add-ons?**

A: Yes! Guests can buy and own add-ons. However, some add-ons (Visual Packs, Hype Effects) can only be activated by the party host (DJ).

**Q: What happens to my add-ons if I cancel my subscription?**

A: Permanent add-ons (Visual Packs, DJ Titles, Profile Upgrades) remain yours forever, even if you downgrade to the free tier. Party Extensions only last for the current session anyway.

### Visual Packs

**Q: Can guests see my active visual pack?**

A: Yes! When you activate a visual pack as the DJ, all phones in the party display the effects.

**Q: Can I activate multiple visual packs at once?**

A: No. Only one visual pack can be active at a time (REPLACE behavior). However, you can own all packs and switch between them instantly.

**Q: Do visual packs drain battery faster?**

A: Yes, slightly. Visual effects require more GPU processing. The impact is minimal for short parties (1-2 hours) but noticeable for longer sessions.

### Profile Upgrades

**Q: If I buy all profile upgrades, do they all show at once?**

A: Yes! Profile upgrades STACK - all purchased upgrades display simultaneously. You could have a verified badge + crown + animated name + reaction trail all active at once.

**Q: Can I turn off specific profile upgrades?**

A: Currently no. All purchased profile upgrades are permanently active. Buy only the ones you want to always display.

**Q: Do profile upgrades show when I'm a guest in someone else's party?**

A: Yes! Profile upgrades are personal to you and visible in any party you join, whether you're the DJ or a guest.

### DJ Titles

**Q: What's the difference between DJ Titles and Profile Upgrades?**

A: DJ Titles are badges showing your DJ status (only one active at a time). Profile Upgrades are cosmetic enhancements (all stack together). You can have both!

**Q: Can I have a DJ Title active as a guest?**

A: Yes! DJ Titles are visible whether you're hosting a party or joining as a guest. They show your DJ experience/status.

**Q: Should I buy titles in order (Rising → Legend)?**

A: Not required! Buy any title you want. Many DJs collect all four to match different party contexts.

### Party Extensions

**Q: If I buy "Add 30 Minutes" but the party ends early, do I lose it?**

A: Yes. Party Extensions are consumed immediately upon purchase and last only for that session. Don't buy extensions until you're sure you need them.

**Q: Can I buy Party Extensions in advance?**

A: No. Extensions apply to the current party only. Buy them during the party when you need them.

**Q: Do Party Extensions carry over to my next party?**

A: No. Each new party starts fresh with your subscription tier limits. Extensions are per-session only.

**Q: What's cheaper: Pro Monthly or Party Pass + Extensions?**

A: Depends on usage:
- **Frequent parties (5+/month)**: Pro Monthly (£9.99/month)
- **Occasional parties (2-3/month)**: Party Pass + Extensions (~£6-8 per party)
- **Rare parties (1/month)**: Free + Extensions (~£3-5 per party)

### Hype Effects

**Q: What happens visually when I trigger a hype effect?**

A: Currently, quantity tracking works but visual/audio effects are not yet implemented. Future updates will add:
- **Confetti Blast**: Animated confetti falling on all screens
- **Laser Show**: Synchronized laser beams and strobing
- **Crowd Roar**: Amplified crowd cheer sound effect
- **Fireworks**: Animated fireworks explosions

**Q: Can guests trigger hype effects they own?**

A: No. Only the party host (DJ) can trigger hype effects, even if guests own them. This prevents spam and keeps the DJ in control of party moments.

**Q: How many hype effects should I buy for a 2-hour party?**

A: Recommendations:
- **Casual party**: 1-2 effects (£0.50-£2)
- **Standard party**: 3-5 effects (£2-£5)
- **Special event**: 8-12 effects (£8-£12)

**Q: Do hype effects expire?**

A: No! Owned hype effects never expire. Buy in bulk and use whenever you want.

### Payment & Billing

**Q: What payment methods are accepted?**

A: Currently simulated for demo purposes. Production will support:
- **Web**: Credit/debit cards via Stripe
- **iOS**: Apple In-App Purchase
- **Android**: Google Play Billing

**Q: Are prices shown including tax?**

A: Prices are shown in GBP (£) and include VAT where applicable. Final price may vary slightly based on your location.

**Q: Can I gift add-ons to friends?**

A: Not yet, but this is planned for a future update!

**Q: Where can I see my purchase history?**

A: Currently in localStorage (demo mode). Production version will have a dedicated "My Purchases" page in your profile.

---

## Quick Reference Card

### Add-on Types Summary

| Category | Type | Price Range | Behavior | Lasts |
|----------|------|-------------|----------|-------|
| **Visual Packs** 🎨 | Cosmetic (DJ) | £2.99-£3.99 | REPLACE | Forever |
| **DJ Titles** 🎧 | Badge | £0.99-£3.49 | REPLACE | Forever |
| **Profile Upgrades** ✨ | Cosmetic (Personal) | £1.99-£2.99 | STACK | Forever |
| **Party Extensions** ⚡ | Booster | £0.99-£1.49 | STACK | Current session |
| **Hype Effects** 🔥 | Consumable | £0.49-£1.49 | CONSUMABLE | Until used |

### Recommended Starter Bundles

**Budget Starter (£5-10)**
- 1 DJ Title (Rising DJ - £0.99)
- 1 Profile Upgrade (Verified Badge - £1.99)
- 3 Hype Effects for your first party (£2-3)

**Standard Starter (£15-20)**
- 1 Visual Pack (Club - £2.99)
- 2 DJ Titles (Rising + Club - £2.48)
- 2 Profile Upgrades (Verified + Animated Name - £4.48)
- 5 Hype Effects variety pack (£4-5)

**Premium Starter (£30-40)**
- 3 Visual Packs (all - £10.47)
- 4 DJ Titles (all - £9.46)
- 4 Profile Upgrades (all - £9.46)
- 10+ Hype Effects arsenal (£7-10)

**Total for Complete Collection**: £35-40 for every permanent add-on + starter hype effects

---

## Support & Feedback

**Questions about add-ons?** Contact support or check the in-app help section.

**Want to suggest new add-ons?** We'd love to hear your ideas! Submit feedback through the app or repository.

**Found a bug with add-ons?** Report it via GitHub issues or support email.

---

**Document Version**: 1.0  
**Last Updated**: February 2026  
**Covers**: Visual Packs, DJ Titles, Profile Upgrades, Party Extensions, Hype Effects
