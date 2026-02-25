# Add-ons Visual Reference Guide

**Where do add-on effects appear? What do they look like?**

This guide explains exactly where each add-on type displays visually in the Phone Party app and what happens when they're activated.

## 📋 Quick Visual Location Map

| Add-on Type | Where It Appears | Visual Effect | Visible To |
|-------------|------------------|---------------|------------|
| **Visual Packs** | DJ booth visual area, main visual container | Animated backgrounds, color schemes, lighting effects | All party members |
| **Profile Upgrades** | Profile header (top of profile pages) | Badge icons stacked next to name/avatar | All party members (personal) |
| **DJ Titles** | DJ name display in party info | Title text/badge next to DJ name | All party members |
| **Party Extensions** | Party info panels (time/phone count) | Updated numbers in party status | All party members |
| **Hype Effects** | Full-screen canvas overlay | Animated effects covering entire screen | All party members |

---

## 🎨 Visual Packs - DJ Visual Effects

### Where They Appear

**Primary Location: DJ Booth Visual Area**
- **Landing Page**: `.dj-booth-visual` - Animated lights on the home screen (lines 228-232 in index.html)
- **DJ View**: `.dj-main-visual` - Main visual container in DJ mode (line 583 in index.html)
- **Guest View**: `#guestDjVisuals` - Visual container on guest screens (line 1003 in index.html)

**Technical Implementation:**
```javascript
// Location: app.js lines 8876-8891
function applyActiveVisualPack() {
  const packId = monetizationState.activeVisualPack;
  
  // Sets CSS custom property for colors
  document.documentElement.style.setProperty('--visual-pack-primary', pack.previewColor);
  
  // Updates visual stage with pack ID
  const visualStage = document.querySelector('.visual-stage');
  visualStage.setAttribute('data-pack', packId);
}
```

### What They Look Like

#### Neon Pack (£3.99) 🌈
**Visual Characteristics:**
- **Colors**: Electric neon pink, cyan, purple
- **Animation**: Pulsing energy waves
- **Effects**: Bright glowing borders, neon light trails
- **Atmosphere**: High-energy, festival vibes

**Where You See It:**
- DJ booth lights pulse with neon colors
- Background gradients shift between electric colors
- Beat-reactive neon borders on UI elements
- Particle effects with neon trails

#### Club Pack (£2.99) 🎆
**Visual Characteristics:**
- **Colors**: Dark backgrounds with strobing white/red lights
- **Animation**: Strobing light effects
- **Effects**: Darkness punctuated by sharp light flashes
- **Atmosphere**: Underground club, intense

**Where You See It:**
- Dark background with occasional bright flashes
- Strobe light effects synchronized to beat
- High-contrast lighting (dark → bright → dark)
- Minimal ambient light between flashes

#### Pulse Pack (£3.49) 💫
**Visual Characteristics:**
- **Colors**: Soft purples, blues, gradients
- **Animation**: Rhythmic expanding/contracting circles
- **Effects**: Smooth pulsing waves from center
- **Atmosphere**: Chill, hypnotic, trance-like

**Where You See It:**
- Concentric circles pulse from center
- Smooth gradient transitions
- Wave effects emanate from DJ booth
- Gentle breathing/pulsing animation

### How Visual Packs Work

**Activation:**
1. DJ navigates to Visual Packs store (Upgrade Hub → Visual Packs)
2. Clicks "Set Active" on owned pack
3. `activateVisualPack(packId)` is called
4. `applyActiveVisualPack()` updates the visual stage immediately

**Visibility:**
- ✅ **All phones** in the party see the active visual pack
- ✅ Changes apply **immediately** when pack is switched
- ✅ Visual effects are **synchronized** across all devices
- ✅ Continues until DJ switches to different pack or deactivates

**Technical Details:**
- Visual effects rendered via `visual-stage.js` (10KB JavaScript file)
- Canvas-based animation system with requestAnimationFrame
- CSS custom properties control colors: `--visual-pack-primary`
- Data attribute on visual stage element: `data-pack="neon_pack"`

---

## ✨ Profile Upgrades - Personal Enhancements

### Where They Appear

**Primary Location: Profile Header**
- **My Profile Page**: `.profile-header` (line 1810 in index.html)
- **Leaderboard**: `.profile-header` (line 2255 in index.html)
- **Party Guest List**: Inline in guest name displays
- **DJ Info**: Next to DJ name in party info panels

**HTML Structure:**
```html
<div class="profile-header">
  <div class="profile-avatar">🎧</div>
  <div class="profile-info">
    <h3 id="profileDjName">DJ Name</h3>
    <!-- Profile upgrade badges appear here: -->
    <span class="upgrade-profile-badge" title="Verified Badge">✓</span>
    <span class="upgrade-profile-badge" title="Crown Effect">👑</span>
  </div>
</div>
```

**Technical Implementation:**
```javascript
// Location: app.js lines 8966-8985
function applyProfileUpgrades() {
  const profileHeader = document.querySelector('.profile-header');
  
  // Add all owned upgrade badges
  monetizationState.ownedProfileUpgrades.forEach(upgradeId => {
    const upgrade = PROFILE_UPGRADES[upgradeId];
    const badge = document.createElement('span');
    badge.className = 'upgrade-profile-badge';
    badge.textContent = upgrade.icon;  // e.g., '✓', '👑', '✨', '🌟'
    badge.title = upgrade.name;
    profileHeader.appendChild(badge);
  });
}
```

### What They Look Like

#### Verified Badge (£1.99) ✓
**Visual Characteristics:**
- **Icon**: Blue checkmark (✓)
- **Position**: Immediately after your name
- **Size**: Small badge icon (~16px)
- **Color**: Blue (#1DA1F2, Twitter-style)

**Where You See It:**
- ✓ Next to your name in My Profile
- ✓ In party guest lists
- ✓ On leaderboards
- ✓ In DJ info displays

**CSS Styling:**
```css
.upgrade-profile-badge {
  display: inline-block;
  margin-left: 4px;
  font-size: 14px;
  opacity: 0.9;
}
```

#### Crown Effect (£2.99) 👑
**Visual Characteristics:**
- **Icon**: Gold crown (👑)
- **Position**: Above your avatar or next to name
- **Size**: Medium badge icon (~18px)
- **Animation**: Subtle glow/shine effect

**Where You See It:**
- 👑 Above profile avatar
- 👑 Next to your name
- 👑 In guest lists with slight golden glow
- 👑 Prominently on leaderboards

#### Animated Name (£2.49) ✨
**Visual Characteristics:**
- **Effect**: Name text glows and pulses
- **Animation**: Continuous soft pulsing (0.8 opacity → 1.0 → 0.8)
- **Color**: Adds sparkle overlay or gradient shimmer
- **Speed**: 2-second pulse cycle

**Where You See It:**
- Your name text itself becomes animated
- Applies to all name displays (profile, party, leaderboard)
- Subtle sparkle effect on the text
- Gentle breathing animation

**CSS Implementation:**
```css
.animated-name {
  animation: name-pulse 2s ease-in-out infinite;
  background: linear-gradient(90deg, #fff, #ffd700, #fff);
  background-size: 200% 100%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

@keyframes name-pulse {
  0%, 100% { opacity: 0.8; background-position: 0% 50%; }
  50% { opacity: 1.0; background-position: 100% 50%; }
}
```

#### Reaction Trail (£1.99) 🌟
**Visual Characteristics:**
- **Effect**: Particle trail when you send reactions
- **Animation**: Star particles fade and float upward
- **Duration**: 1-2 seconds after reaction
- **Color**: Gold/yellow stars

**Where You See It:**
- When you click any reaction button (🔥, 💯, 😂, etc.)
- Trail emanates from your avatar/name
- Visible to all party members
- Particles fade as they rise

**Animation Details:**
- 5-10 star particles spawn
- Each particle: moves up 50-100px, rotates 0-360°, fades out
- Total animation time: 1.5 seconds
- Particle size: 12-20px, random variation

### How Profile Upgrades Work

**Activation:**
1. User purchases a profile upgrade
2. `purchaseProfileUpgrade(upgradeId)` adds it to owned list
3. `applyProfileUpgrades()` is called immediately
4. **No manual activation needed** - all owned upgrades are always active

**Stacking Behavior:**
```
Example: User owns all 4 upgrades
Display: "DJ Shadow ✓ 👑 ✨ 🌟"

- ✓ Verified Badge
- 👑 Crown Effect  
- ✨ Animated Name (name text itself pulses)
- 🌟 Reaction Trail (appears when reacting)
```

**Visibility:**
- ✅ Visible on **your profile** across all views
- ✅ Visible to **all other users** in any party you join
- ✅ Visible whether you're **DJ or guest**
- ✅ Persists **across all sessions** (saved in localStorage + database)

**Performance Note:**
- Animated Name uses CSS animations (GPU-accelerated)
- Reaction Trail spawns DOM elements briefly (cleaned up after animation)
- Crown/Verified are static icons (zero performance impact)

---

## 🎧 DJ Titles - Status Badges

### Where They Appear

**Primary Location: DJ Name Display**
- **Party Info Panels**: Next to DJ name in party details
- **My Profile**: Title display under DJ name (#djTitle element, line 8942 in app.js)
- **Leaderboards**: Listed with DJ's name
- **Guest View**: Shows active title in "Hosted by" section

**HTML Structure:**
```html
<!-- DJ View Party Info -->
<div class="dj-party-info">
  <h3>DJ Shadow</h3>
  <div id="djTitle">Legend DJ</div>  <!-- Active title appears here -->
</div>

<!-- Guest View -->
<div class="party-info-value">
  Hosted by DJ Shadow - <span class="dj-title-badge">Legend DJ 👑</span>
</div>
```

**Technical Implementation:**
```javascript
// Location: app.js lines 8932-8944
function updateDJTitleDisplay() {
  const titleId = monetizationState.activeTitle;
  const title = DJ_TITLES[titleId];
  
  const djTitleEl = document.getElementById('djTitle');
  if (djTitleEl) {
    djTitleEl.textContent = title.name;  // e.g., "Legend DJ"
  }
}
```

### What They Look Like

#### Rising DJ (£0.99) 🌟
**Visual Characteristics:**
- **Badge**: "Rising DJ 🌟"
- **Color**: Yellow/gold tones
- **Style**: Beginner-friendly, optimistic
- **Size**: Small text badge (14px font)

**Where You See It:**
```
Party hosted by DJ Shadow - Rising DJ 🌟
```

#### Club DJ (£1.49) 🎵
**Visual Characteristics:**
- **Badge**: "Club DJ 🎵"
- **Color**: Blue/purple tones
- **Style**: Professional, established
- **Size**: Medium text badge (15px font)

**Where You See It:**
```
Party hosted by DJ Shadow - Club DJ 🎵
```

#### Superstar DJ (£2.49) ⭐
**Visual Characteristics:**
- **Badge**: "Superstar DJ ⭐"
- **Color**: Bright gold/white gradient
- **Style**: Bold, attention-grabbing
- **Animation**: Subtle shimmer effect
- **Size**: Large text badge (16px font)

**Where You See It:**
```
Party hosted by DJ Shadow - Superstar DJ ⭐
```

#### Legend DJ (£3.49) 👑
**Visual Characteristics:**
- **Badge**: "Legend DJ 👑"
- **Color**: Royal purple/gold gradient
- **Style**: Premium, prestigious
- **Animation**: Pulsing glow effect
- **Size**: Extra large text badge (17px font, bold)

**Where You See It:**
```
Party hosted by DJ Shadow - Legend DJ 👑
```

**CSS Styling:**
```css
.dj-title-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-weight: 600;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

.dj-title-badge.legend {
  animation: title-glow 2s ease-in-out infinite;
}

@keyframes title-glow {
  0%, 100% { box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4); }
  50% { box-shadow: 0 4px 16px rgba(102, 126, 234, 0.8); }
}
```

### How DJ Titles Work

**Activation:**
1. User navigates to DJ Titles store
2. Clicks "Activate" on owned title
3. `activateTitle(titleId)` is called
4. `updateDJTitleDisplay()` updates all displays immediately
5. **Only one title can be active at a time** (REPLACE behavior)

**Visibility:**
- ✅ Visible to **all party members**
- ✅ Shows in **party info panels**
- ✅ Displays on **your profile**
- ✅ Appears in **leaderboards**
- ✅ Visible whether you're **hosting or joining** as guest

**Switching Titles:**
```javascript
// Example: DJ owns all 4 titles, wants to switch based on party vibe

// Casual party with friends
activateTitle('rising_title');  // Shows: "Rising DJ 🌟"

// Weekend club night
activateTitle('club_title');     // Shows: "Club DJ 🎵"

// Special event
activateTitle('superstar_title'); // Shows: "Superstar DJ ⭐"

// Major celebration
activateTitle('legend_title');    // Shows: "Legend DJ 👑"
```

---

## ⚡ Party Extensions - Session Boosters

### Where They Appear

**Primary Locations: Party Info Displays**

#### Time Extensions
- **DJ View**: `.dj-party-info` → Time remaining display
- **Guest View**: `#guestTimeRemaining` (line 964 in index.html)
- **Party Header**: Countdown timer in top bar

**HTML Structure:**
```html
<!-- DJ View -->
<div class="party-info-item">
  <div class="party-info-label">⏰ Time Left</div>
  <div class="party-info-value" id="djTimeRemaining">1:45:30</div>
</div>

<!-- Guest View -->
<div class="party-info-item">
  <div class="party-info-label">⏰ Time Remaining</div>
  <div class="party-info-value" id="guestTimeRemaining">1:45:30</div>
</div>
```

#### Phone Capacity Extensions
- **DJ View**: `.dj-party-info` → Guest count display
- **Guest View**: `#guestPartyGuestCount` (line 960 in index.html)
- **Party Header**: Shows "X / Y guests" where Y is capacity

**HTML Structure:**
```html
<!-- Shows current vs. max capacity -->
<div class="party-info-item">
  <div class="party-info-label">👥 Guests</div>
  <div class="party-info-value">3 / 9 phones</div>
  <!--                              ^ Max increased by extensions -->
</div>
```

### What They Look Like

#### Add 30 Minutes (£0.99)
**Before Purchase:**
```
⏰ Time Left: 0:15:30
```

**After Purchase (immediate effect):**
```
⏰ Time Left: 0:45:30  ← +30 minutes added
```

**Visual Feedback:**
- Green flash animation when time is added
- Toast notification: "✅ +30 minutes added to party!"
- Timer display updates immediately
- All guests see the updated time simultaneously

#### Add 5 Phones (£1.49)
**Before Purchase:**
```
👥 Guests: 4 / 4 phones (FULL)
```

**After Purchase (immediate effect):**
```
👥 Guests: 4 / 9 phones  ← Capacity increased by 5
```

**Visual Feedback:**
- Blue flash animation when capacity increases
- Toast notification: "✅ +5 phone capacity added!"
- Guest count display updates immediately
- New guests can now join (previously blocked)
- All party members see updated capacity

**Technical Implementation:**
```javascript
// Location: app.js lines 8990-9006
function purchasePartyExtension(extensionId) {
  const extension = PARTY_EXTENSIONS[extensionId];
  
  // Time extension
  if (extension.extensionMinutes) {
    monetizationState.partyTimeExtensionMins += extension.extensionMinutes;
    // Apply to current party end time
    if (state.partyPassEndTime) {
      state.partyPassEndTime += extension.extensionMinutes * 60 * 1000;
    }
  }
  
  // Phone capacity extension
  if (extension.extensionPhones) {
    monetizationState.partyPhoneExtensionCount += extension.extensionPhones;
  }
}
```

### How Party Extensions Work

**Purchase Flow:**
1. DJ purchases extension during active party
2. Extension applies **immediately** to current session
3. Party info displays update across all devices
4. Extensions **stack** - can buy multiple

**Stacking Example:**
```javascript
// Party Pass tier: 2 hours, 4 phones
Initial state: 2:00:00 time, 4 phone capacity

// Buy "Add 30 Minutes" (£0.99)
After purchase #1: 2:30:00 time, 4 phone capacity

// Buy "Add 30 Minutes" again (£0.99)
After purchase #2: 3:00:00 time, 4 phone capacity  // ← Stacked!

// Buy "Add 5 Phones" (£1.49)
After purchase #3: 3:00:00 time, 9 phone capacity

// Buy "Add 5 Phones" again (£1.49)
Final state: 3:00:00 time, 14 phone capacity  // ← Stacked!
```

**Visual Updates (Synchronized):**
```
All phones in party see:
1. Flash animation at extension purchase
2. Updated numbers in party info panels
3. Toast notification confirming the extension
4. Countdown timer with new end time (for time extensions)
5. Guest list with new capacity (for phone extensions)
```

**Session Scope:**
- ⚠️ Extensions only last for **current party session**
- ⚠️ When party ends, extensions are **not carried over**
- ⚠️ New party starts fresh with subscription tier limits
- ⚠️ Need to re-purchase extensions for each party

---

## 🔥 Hype Effects - Epic Party Moments

### Where They Appear

**Primary Location: Full-Screen Canvas Overlay**

**Technical Architecture:**
```html
<!-- Created dynamically by visual-stage.js -->
<canvas id="visualStageCanvas" style="
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 999;
  display: none;
"></canvas>
```

**Rendering System:**
- Full-screen HTML5 Canvas element
- Position: Fixed, covers entire viewport
- Z-index: 999 (above all other content)
- Pointer-events: none (clicks pass through to UI below)
- Animation: requestAnimationFrame loop (60 FPS)

**File Location:** `visual-stage.js` (lines 1-233)

### What They Look Like

#### Confetti Blast (£0.49) 🎊 - 5 seconds

**Visual Effect:**
```
Trigger → 500+ confetti pieces explode from center
       ↓
    Pieces fly in all directions (physics simulation)
       ↓
    Pieces fall with gravity, rotation, and flutter
       ↓
    Fade out and cleanup (5 second total duration)
```

**Detailed Description:**
- **Spawn Point**: Center of screen
- **Particle Count**: 500-700 random pieces
- **Colors**: Rainbow mix (red, orange, yellow, green, blue, purple, pink)
- **Shapes**: Rectangles, circles, triangles (random)
- **Initial Velocity**: Random outward explosion (20-40 px/frame)
- **Physics**:
  - Gravity: 0.5 px/frame² downward
  - Air resistance: 2% velocity reduction per frame
  - Rotation: Random spin (-10° to +10° per frame)
  - Flutter: Side-to-side wobble (sine wave)
- **Lifetime**: 5 seconds, fade out in last 1 second

**Visual Experience:**
```
[Animation Timeline]
0.0s: 💥 BOOM! Confetti explodes from center
0.5s: Pieces reach peak velocity, spreading wide
1.0s: Pieces begin falling, rotating, fluttering
2.0s: Most pieces falling downward in cascades
3.0s: Pieces continue falling across screen
4.0s: Pieces start fading out (opacity 1.0 → 0.0)
5.0s: All pieces removed, canvas cleared
```

**Code Implementation:**
```javascript
// Simplified confetti effect
function triggerConfetti() {
  for (let i = 0; i < 600; i++) {
    particles.push({
      x: canvas.width / 2,
      y: canvas.height / 2,
      vx: (Math.random() - 0.5) * 40,
      vy: (Math.random() - 0.5) * 40 - 20,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 20,
      color: randomColor(),
      size: Math.random() * 10 + 5,
      life: 5000
    });
  }
}
```

#### Laser Show (£0.99) ⚡ - 10 seconds

**Visual Effect:**
```
Trigger → Laser beams shoot across screen
       ↓
    Multiple beam colors (red, green, blue, purple)
       ↓
    Beams rotate, pulse, strobe effect
       ↓
    Fade out gradually (10 second duration)
```

**Detailed Description:**
- **Beam Count**: 8-12 laser beams
- **Colors**: Neon red, green, blue, purple (alternating)
- **Width**: 2-4px per beam
- **Animation**:
  - Rotation: 360° rotation over 2 seconds
  - Pulsing: Opacity 0.6 → 1.0 → 0.6 (1 second cycle)
  - Strobe: 100ms flash every 500ms
  - Beam length: Full diagonal of screen
- **Origin Points**: Corners and edges of screen
- **Patterns**: Rotating fan, crossing X, parallel sweep
- **Lifetime**: 10 seconds, strobe increases at 7s+

**Visual Experience:**
```
[Animation Timeline]
0.0s: ⚡ Laser beams appear from corners
1.0s: Beams rotate clockwise, pulsing brightness
2.0s: Beams form X pattern across screen
3.0s: Beams sweep in parallel across viewport
4.0s: Rotation reverses to counter-clockwise
5.0s: Beams pulse faster, strobing begins
6.0s: Full rotation fan pattern
7.0s: Strobe effect intensifies
8.0s: Beams begin fading out (opacity drops)
9.0s: Final strobe bursts
10.0s: Beams fully fade, canvas cleared
```

**Code Implementation:**
```javascript
// Simplified laser show
function drawLaser(beam) {
  ctx.strokeStyle = beam.color;
  ctx.lineWidth = beam.width;
  ctx.globalAlpha = beam.opacity * (0.6 + 0.4 * Math.sin(Date.now() / 500));
  
  ctx.beginPath();
  ctx.moveTo(beam.x1, beam.y1);
  ctx.lineTo(beam.x2, beam.y2);
  ctx.stroke();
}
```

#### Crowd Roar (£0.79) 📣 - 3 seconds

**Visual Effect:**
```
Trigger → Screen shakes slightly
       ↓
    Sound wave visual ripples outward
       ↓
    "YEAH!" text appears and scales up
       ↓
    Quick fade out (3 second duration)
```

**Detailed Description:**
- **Screen Shake**: 
  - Intensity: 5-10px random displacement
  - Duration: First 0.5 seconds
  - Frequency: 60 Hz (every frame)
- **Sound Wave Ripples**:
  - Count: 5-7 concentric circles
  - Origin: Center of screen
  - Speed: Expand outward at 100px/second
  - Color: White with low opacity (0.3)
  - Thickness: 3px stroke
- **Text Display**:
  - Text: "YEAH!" or "WOO!" (random)
  - Font: Bold, 120px
  - Color: White with yellow stroke
  - Animation: Scale from 0.5 → 1.5, fade in/out
  - Position: Center screen
- **Audio**: Crowd cheer sound effect (3 seconds)
- **Lifetime**: 3 seconds total

**Visual Experience:**
```
[Animation Timeline]
0.0s: 📣 Screen shakes, ripples start
0.5s: Shake stops, "YEAH!" text scales up
1.0s: Ripples expand across screen
1.5s: Text at full size, ripples continuing
2.0s: Text starts fading, ripples fade
2.5s: All effects fading out
3.0s: Canvas cleared, effect complete
```

#### Fireworks (£1.49) 🎆 - 8 seconds

**Visual Effect:**
```
Trigger → Rockets shoot upward
       ↓
    Explosions at peak (multiple bursts)
       ↓
    Particle trails falling downward
       ↓
    Fade and cleanup (8 second duration)
```

**Detailed Description:**
- **Rocket Launch**:
  - Count: 5-8 rockets per second (40-64 total)
  - Start Position: Bottom of screen (random X)
  - Speed: 15-25 px/frame upward
  - Trail: Glowing particle trail behind rocket
  - Colors: Red, orange, yellow, green, blue, purple
- **Explosion**:
  - Trigger: Rocket reaches 20-40% screen height
  - Burst Size: 100-200 particles per explosion
  - Pattern: Circular burst (360° spread)
  - Particle Speed: 5-15 px/frame radially outward
  - Sparkles: Random sparkle effect on particles
- **Particle Physics**:
  - Gravity: 0.3 px/frame² downward
  - Fade: Opacity 1.0 → 0.0 over 2-3 seconds
  - Trail: Each particle leaves short tail
  - Twinkle: Random brightness variation
- **Lifetime**: 8 seconds, continuous launches 0-5s

**Visual Experience:**
```
[Animation Timeline]
0.0s: 🎆 First rockets launch from bottom
0.5s: Rockets explode at peak → particle bursts
1.0s: More rockets launch, particles falling
1.5s: Multiple explosions lighting up sky
2.0s: Continuous rocket launches
2.5s: Screen filled with falling particles
3.0s: Peak visual density (most spectacular)
3.5s: Launch rate slows down
4.0s: Final rockets launch
4.5s: Last explosions occur
5.0s: No more launches, particles falling
6.0s: Particles fading out
7.0s: Most particles gone
8.0s: Final particles fade, canvas cleared
```

**Code Implementation:**
```javascript
// Simplified fireworks
function launchRocket() {
  rockets.push({
    x: Math.random() * canvas.width,
    y: canvas.height,
    vy: -(Math.random() * 10 + 15),
    color: randomColor(),
    exploded: false
  });
}

function explodeRocket(rocket) {
  for (let i = 0; i < 150; i++) {
    const angle = (Math.PI * 2 * i) / 150;
    const speed = Math.random() * 10 + 5;
    particles.push({
      x: rocket.x,
      y: rocket.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color: rocket.color,
      life: 3000
    });
  }
}
```

### How Hype Effects Work

**Purchase & Storage:**
```javascript
// Hype effects are CONSUMABLE - stored as quantities
monetizationState.hypeEffects = {
  confetti_blast: 3,  // Own 3 uses
  laser_show: 1,      // Own 1 use
  crowd_roar: 2,      // Own 2 uses
  fireworks: 0        // None owned
};
```

**Trigger Flow:**
1. **DJ Only**: Only party host can trigger hype effects
2. **Inventory Check**: Verify quantity > 0
3. **Canvas Activation**: Show canvas overlay (z-index 999)
4. **Effect Rendering**: Start animation loop for that effect
5. **Quantity Decrement**: Reduce count by 1
6. **Broadcast**: Send event to all guests via WebSocket
7. **Synchronized Display**: All party members see effect simultaneously
8. **Cleanup**: Remove particles, hide canvas when complete

**Synchronization:**
```javascript
// DJ triggers effect
socket.emit('hype-effect', { 
  effectId: 'confetti_blast',
  timestamp: Date.now()
});

// All guests receive and render
socket.on('hype-effect', (data) => {
  triggerHypeEffect(data.effectId);
});
```

**Visibility:**
- ✅ **All party members** see the effect at the same time
- ✅ Covers **full screen** on all devices
- ✅ **Does not interrupt** music or UI interaction
- ✅ Clicks **pass through** to UI below (pointer-events: none)

**Performance:**
- Canvas rendering: GPU-accelerated
- Particle count optimized for mobile devices
- Automatic cleanup of completed particles
- Memory efficient (particles removed after animation)

---

## 🎯 Summary Table - Where Effects Are Visible

| Effect Type | DJ Sees | Guests See | Location | Persistence |
|-------------|---------|------------|----------|-------------|
| **Visual Packs** | ✅ Full visual effects | ✅ Full visual effects | DJ booth, visual containers | Until changed |
| **Profile Upgrades** | ✅ On own profile | ✅ On your profile in guest list | Profile headers everywhere | Forever (permanent) |
| **DJ Titles** | ✅ In party info | ✅ In "Hosted by" section | Party info panels | Until changed |
| **Time Extensions** | ✅ Updated timer | ✅ Updated timer | Party info panels | Current session |
| **Phone Extensions** | ✅ Updated capacity | ✅ Updated capacity | Guest count displays | Current session |
| **Hype Effects** | ✅ Full-screen | ✅ Full-screen | Canvas overlay | 3-10 seconds |

---

## 📱 Device-Specific Rendering

### Mobile Devices (< 768px)
- Visual effects scaled to viewport size
- Particle counts reduced by 30% for performance
- Touch-friendly, no hover effects needed
- Effects fill entire screen (safe areas respected)

### Tablets (768px - 1024px)
- Full particle counts
- Medium-density effects
- Landscape/portrait adaptive layouts

### Desktop (> 1024px)
- Maximum particle counts
- High-density effects
- Widescreen optimizations
- Additional background layers

---

## 🎨 CSS Custom Properties Used

```css
/* Visual Pack Colors */
--visual-pack-primary: #ff00ff;  /* Set by active pack */

/* Profile Upgrade Animations */
--profile-glow-color: rgba(255, 215, 0, 0.5);
--profile-pulse-duration: 2s;

/* DJ Title Gradients */
--title-gradient-start: #667eea;
--title-gradient-end: #764ba2;

/* Hype Effect Overlays */
--hype-overlay-bg: rgba(0, 0, 0, 0.3);
```

---

## 🔍 Debugging & Inspection

**To See Add-on Effects in Dev Mode:**

1. **Enable Dev Mode**: Add `?devmode=true` to URL
2. **Dev Panel Navigation**: Quick links to all add-on stores
3. **Console Logging**: Visual stage logs all effect triggers
4. **Canvas Inspection**: visualStageCanvas element in DOM
5. **State Inspection**: Check `monetizationState` in console

**Console Commands:**
```javascript
// Check what's active
console.log(monetizationState);

// Manually trigger hype effect (dev only)
triggerHypeEffect('confetti_blast');

// See visual pack CSS var
getComputedStyle(document.documentElement)
  .getPropertyValue('--visual-pack-primary');
```

---

## 📸 Visual Examples (Coming Soon)

*Screenshots and screen recordings will be added to show actual visual appearance of each effect type.*

---

**Document Version**: 1.0  
**Last Updated**: February 2026  
**Related Docs**: 
- [ADD_ONS_USER_GUIDE.md](./ADD_ONS_USER_GUIDE.md) - Complete functional guide
- [ADD_ONS_QUICK_REFERENCE.md](./ADD_ONS_QUICK_REFERENCE.md) - Quick reference card
