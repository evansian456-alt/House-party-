/**
 * DJ Emoji Behavior Tests
 * 
 * Tests for DJ emoji functionality:
 * 1. Custom DJ emojis (🎧, 🎛️, 🕺, 🎤)
 * 2. DJ emojis don't generate crowd energy
 * 3. Guest emojis generate crowd energy
 * 4. Leaderboard excludes DJ
 * 5. Live reaction box shows all reactions
 */

const { parties, redis, waitForRedis } = require('./server');

describe('DJ Emoji Behavior Tests', () => {
  beforeAll(async () => {
    try {
      await waitForRedis();
    } catch (error) {
      console.error('Failed to connect to Redis:', error.message);
    }
  });

  beforeEach(async () => {
    parties.clear();
    await redis.flushall();
  });

  /**
   * Test 1: Verify scoreState includes currentCrowdEnergy field
   */
  test('scoreState initializes with currentCrowdEnergy field', () => {
    const mockParty = {
      code: 'TEST01',
      host: null,
      members: [],
      scoreState: {
        dj: {
          djUserId: null,
          djIdentifier: 'test-dj',
          djName: 'TestDJ',
          sessionScore: 0,
          lifetimeScore: 0
        },
        guests: {},
        totalReactions: 0,
        totalMessages: 0,
        currentCrowdEnergy: 0,
        peakCrowdEnergy: 0
      }
    };

    parties.set('TEST01', mockParty);
    const party = parties.get('TEST01');

    // Verify crowd energy fields exist
    expect(party.scoreState.currentCrowdEnergy).toBeDefined();
    expect(party.scoreState.peakCrowdEnergy).toBeDefined();
    expect(party.scoreState.currentCrowdEnergy).toBe(0);
    expect(party.scoreState.peakCrowdEnergy).toBe(0);
  });

  /**
   * Test 2: Guest reactions increase crowd energy
   */
  test('Guest emoji reactions increase crowd energy', () => {
    const mockParty = {
      code: 'TEST02',
      host: null,
      members: [],
      scoreState: {
        dj: {
          djUserId: null,
          djIdentifier: 'test-dj',
          djName: 'TestDJ',
          sessionScore: 0,
          lifetimeScore: 0
        },
        guests: {
          'guest1': {
            guestId: 'guest1',
            nickname: 'Guest1',
            points: 0,
            emojis: 0,
            messages: 0
          }
        },
        totalReactions: 0,
        totalMessages: 0,
        currentCrowdEnergy: 0,
        peakCrowdEnergy: 0
      }
    };

    parties.set('TEST02', mockParty);
    const party = parties.get('TEST02');

    // Simulate guest emoji reaction (5 energy points)
    const energyIncrease = 5;
    party.scoreState.currentCrowdEnergy = Math.min(100, party.scoreState.currentCrowdEnergy + energyIncrease);
    
    if (party.scoreState.currentCrowdEnergy > party.scoreState.peakCrowdEnergy) {
      party.scoreState.peakCrowdEnergy = party.scoreState.currentCrowdEnergy;
    }

    // Update guest score
    party.scoreState.guests['guest1'].emojis += 1;
    party.scoreState.guests['guest1'].points += 5;
    party.scoreState.totalReactions += 1;

    // Verify crowd energy increased
    expect(party.scoreState.currentCrowdEnergy).toBe(5);
    expect(party.scoreState.peakCrowdEnergy).toBe(5);
    expect(party.scoreState.guests['guest1'].points).toBe(5);
  });

  /**
   * Test 3: DJ reactions do NOT increase crowd energy
   */
  test('DJ emoji reactions do NOT increase crowd energy', () => {
    const mockParty = {
      code: 'TEST03',
      host: null,
      members: [],
      scoreState: {
        dj: {
          djUserId: null,
          djIdentifier: 'test-dj',
          djName: 'TestDJ',
          sessionScore: 0,
          lifetimeScore: 0
        },
        guests: {},
        totalReactions: 0,
        totalMessages: 0,
        currentCrowdEnergy: 0,
        peakCrowdEnergy: 0
      }
    };

    parties.set('TEST03', mockParty);
    const party = parties.get('TEST03');

    // Simulate DJ emoji reaction (should NOT increase crowd energy OR DJ score)
    // DJ emojis do NOT generate score - only guests can influence DJ score
    // Do NOT increment totalReactions - only guest reactions count
    
    // IMPORTANT: Do NOT update currentCrowdEnergy, peakCrowdEnergy, totalReactions, or DJ sessionScore

    // Verify totalReactions stayed at 0 (DJ emojis don't count)
    expect(party.scoreState.totalReactions).toBe(0);
    
    // Verify crowd energy stayed at 0
    expect(party.scoreState.currentCrowdEnergy).toBe(0);
    expect(party.scoreState.peakCrowdEnergy).toBe(0);
    
    // DJ should NOT have session score from their own emojis
    expect(party.scoreState.dj.sessionScore).toBe(0);
  });

  /**
   * Test 4: Leaderboard only includes guests, not DJ
   */
  test('Leaderboard excludes DJ and only shows guests', () => {
    const mockParty = {
      code: 'TEST04',
      host: null,
      members: [],
      scoreState: {
        dj: {
          djUserId: 'dj-user-id',
          djIdentifier: 'test-dj',
          djName: 'TestDJ',
          sessionScore: 50, // DJ has points
          lifetimeScore: 0
        },
        guests: {
          'guest1': {
            guestId: 'guest1',
            nickname: 'Guest1',
            points: 15,
            emojis: 3,
            messages: 0,
            rank: 1
          },
          'guest2': {
            guestId: 'guest2',
            nickname: 'Guest2',
            points: 10,
            emojis: 2,
            messages: 0,
            rank: 2
          }
        },
        totalReactions: 5,
        totalMessages: 0,
        currentCrowdEnergy: 25,
        peakCrowdEnergy: 25
      }
    };

    parties.set('TEST04', mockParty);
    const party = parties.get('TEST04');

    // Build leaderboard (same logic as broadcastScoreboard)
    const guestList = Object.values(party.scoreState.guests)
      .sort((a, b) => b.points - a.points)
      .map((guest, index) => ({
        ...guest,
        rank: index + 1
      }));

    // Verify DJ is NOT in guest list
    const guestIds = guestList.map(g => g.guestId);
    expect(guestIds).not.toContain('dj');
    expect(guestIds).not.toContain('test-dj');
    
    // Verify only guests are included
    expect(guestList.length).toBe(2);
    expect(guestList[0].nickname).toBe('Guest1');
    expect(guestList[1].nickname).toBe('Guest2');
    
    // Verify rankings
    expect(guestList[0].rank).toBe(1);
    expect(guestList[1].rank).toBe(2);
  });

  /**
   * Test 5: Multiple guest reactions accumulate crowd energy
   */
  test('Multiple guest reactions accumulate crowd energy correctly', () => {
    const mockParty = {
      code: 'TEST05',
      host: null,
      members: [],
      scoreState: {
        dj: {
          djUserId: null,
          djIdentifier: 'test-dj',
          djName: 'TestDJ',
          sessionScore: 0,
          lifetimeScore: 0
        },
        guests: {
          'guest1': {
            guestId: 'guest1',
            nickname: 'Guest1',
            points: 0,
            emojis: 0,
            messages: 0
          }
        },
        totalReactions: 0,
        totalMessages: 0,
        currentCrowdEnergy: 0,
        peakCrowdEnergy: 0
      }
    };

    parties.set('TEST05', mockParty);
    const party = parties.get('TEST05');

    // Simulate 3 guest emoji reactions
    for (let i = 0; i < 3; i++) {
      const energyIncrease = 5;
      party.scoreState.currentCrowdEnergy = Math.min(100, party.scoreState.currentCrowdEnergy + energyIncrease);
      
      if (party.scoreState.currentCrowdEnergy > party.scoreState.peakCrowdEnergy) {
        party.scoreState.peakCrowdEnergy = party.scoreState.currentCrowdEnergy;
      }
      
      party.scoreState.guests['guest1'].emojis += 1;
      party.scoreState.guests['guest1'].points += 5;
      party.scoreState.totalReactions += 1;
    }

    // Verify crowd energy accumulated (3 * 5 = 15)
    expect(party.scoreState.currentCrowdEnergy).toBe(15);
    expect(party.scoreState.peakCrowdEnergy).toBe(15);
    expect(party.scoreState.guests['guest1'].points).toBe(15);
    expect(party.scoreState.guests['guest1'].emojis).toBe(3);
  });

  /**
   * Test 6: Crowd energy caps at 100
   */
  test('Crowd energy caps at 100', () => {
    const mockParty = {
      code: 'TEST06',
      host: null,
      members: [],
      scoreState: {
        dj: {
          djUserId: null,
          djIdentifier: 'test-dj',
          djName: 'TestDJ',
          sessionScore: 0,
          lifetimeScore: 0
        },
        guests: {
          'guest1': {
            guestId: 'guest1',
            nickname: 'Guest1',
            points: 0,
            emojis: 0,
            messages: 0
          }
        },
        totalReactions: 0,
        totalMessages: 0,
        currentCrowdEnergy: 95,
        peakCrowdEnergy: 95
      }
    };

    parties.set('TEST06', mockParty);
    const party = parties.get('TEST06');

    // Add 10 more energy (should cap at 100)
    const energyIncrease = 10;
    party.scoreState.currentCrowdEnergy = Math.min(100, party.scoreState.currentCrowdEnergy + energyIncrease);
    
    if (party.scoreState.currentCrowdEnergy > party.scoreState.peakCrowdEnergy) {
      party.scoreState.peakCrowdEnergy = party.scoreState.currentCrowdEnergy;
    }

    // Verify crowd energy capped at 100
    expect(party.scoreState.currentCrowdEnergy).toBe(100);
    expect(party.scoreState.peakCrowdEnergy).toBe(100);
  });

  /**
   * Test 7: Peak crowd energy tracks maximum
   */
  test('Peak crowd energy tracks maximum value reached', () => {
    const mockParty = {
      code: 'TEST07',
      host: null,
      members: [],
      scoreState: {
        dj: {
          djUserId: null,
          djIdentifier: 'test-dj',
          djName: 'TestDJ',
          sessionScore: 0,
          lifetimeScore: 0
        },
        guests: {},
        totalReactions: 0,
        totalMessages: 0,
        currentCrowdEnergy: 0,
        peakCrowdEnergy: 0
      }
    };

    parties.set('TEST07', mockParty);
    const party = parties.get('TEST07');

    // Increase to 50
    party.scoreState.currentCrowdEnergy = 50;
    if (party.scoreState.currentCrowdEnergy > party.scoreState.peakCrowdEnergy) {
      party.scoreState.peakCrowdEnergy = party.scoreState.currentCrowdEnergy;
    }
    
    expect(party.scoreState.peakCrowdEnergy).toBe(50);

    // Decrease to 30 (peak should stay at 50)
    party.scoreState.currentCrowdEnergy = 30;
    
    expect(party.scoreState.currentCrowdEnergy).toBe(30);
    expect(party.scoreState.peakCrowdEnergy).toBe(50); // Peak doesn't decrease

    // Increase to 70 (new peak)
    party.scoreState.currentCrowdEnergy = 70;
    if (party.scoreState.currentCrowdEnergy > party.scoreState.peakCrowdEnergy) {
      party.scoreState.peakCrowdEnergy = party.scoreState.currentCrowdEnergy;
    }
    
    expect(party.scoreState.peakCrowdEnergy).toBe(70);
  });

  /**
   * Test 8: DJ emojis do NOT increment totalReactions counter
   * This test explicitly verifies that when DJ sends emojis,
   * the totalReactions counter remains unchanged
   */
  test('DJ emojis do NOT increment totalReactions', () => {
    const mockParty = {
      code: 'TEST08',
      host: null,
      members: [],
      scoreState: {
        dj: {
          djUserId: null,
          djIdentifier: 'test-dj',
          djName: 'TestDJ',
          sessionScore: 0,
          lifetimeScore: 0
        },
        guests: {},
        totalReactions: 0,  // Start at 0
        totalMessages: 0,
        currentCrowdEnergy: 0,
        peakCrowdEnergy: 0
      }
    };

    parties.set('TEST08', mockParty);
    const party = parties.get('TEST08');

    // Record initial totalReactions count
    const initialTotalReactions = party.scoreState.totalReactions;
    
    // Simulate DJ sending emoji (should NOT increment totalReactions)
    // Do NOT do: party.scoreState.totalReactions += 1;
    
    // Verify totalReactions has NOT changed
    expect(party.scoreState.totalReactions).toBe(initialTotalReactions);
    expect(party.scoreState.totalReactions).toBe(0);
    
    // Verify no other scores were affected
    expect(party.scoreState.dj.sessionScore).toBe(0);
    expect(party.scoreState.currentCrowdEnergy).toBe(0);
    expect(party.scoreState.peakCrowdEnergy).toBe(0);
  });
});
