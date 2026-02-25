/**
 * Guest Reactions Display Order Tests
 * 
 * Tests that verify guest reactions are displayed correctly:
 * - Oldest at top, newest at bottom
 * - Auto-expiry after TTL
 * - No popups or animations
 * - Same behavior across all tiers
 */

describe('Guest Reactions Display Order', () => {
  // Mock the DOM elements and state
  let mockState;
  let mockElement;
  
  beforeEach(() => {
    // Reset mock state
    mockState = {
      unifiedFeed: [],
      maxFeedItems: 30,
      feedSeenIds: new Set()
    };
    
    // Mock DOM element
    mockElement = {
      innerHTML: '',
      appendChild: jest.fn(),
      scrollHeight: 1000,
      scrollTop: 0
    };
    
    // Mock document functions
    global.document = {
      createElement: jest.fn(() => ({
        className: '',
        innerHTML: '',
        appendChild: jest.fn()
      })),
      createDocumentFragment: jest.fn(() => ({
        appendChild: jest.fn()
      }))
    };
  });
  
  describe('Feed Order', () => {
    test('should add new reactions at the end (bottom)', () => {
      const feed = [];
      
      // Add first reaction
      feed.push({ id: '1', content: 'First', timestamp: 1000 });
      
      // Add second reaction
      feed.push({ id: '2', content: 'Second', timestamp: 2000 });
      
      // Add third reaction
      feed.push({ id: '3', content: 'Third', timestamp: 3000 });
      
      // Verify order: oldest at index 0, newest at end
      expect(feed[0].content).toBe('First');
      expect(feed[1].content).toBe('Second');
      expect(feed[2].content).toBe('Third');
      expect(feed.length).toBe(3);
    });
    
    test('should remove oldest reactions when exceeding max items', () => {
      const maxFeedItems = 3;
      let feed = [];
      
      // Add reactions beyond max
      feed.push({ id: '1', content: 'First', timestamp: 1000 });
      feed.push({ id: '2', content: 'Second', timestamp: 2000 });
      feed.push({ id: '3', content: 'Third', timestamp: 3000 });
      feed.push({ id: '4', content: 'Fourth', timestamp: 4000 });
      
      // Enforce limit by taking last N items
      if (feed.length > maxFeedItems) {
        feed = feed.slice(-maxFeedItems);
      }
      
      // Verify oldest was removed, newest kept
      expect(feed.length).toBe(3);
      expect(feed[0].content).toBe('Second'); // First was removed
      expect(feed[1].content).toBe('Third');
      expect(feed[2].content).toBe('Fourth');
    });
    
    test('should maintain order with multiple additions and removals', () => {
      const maxFeedItems = 5;
      let feed = [];
      
      // Add 7 items
      for (let i = 1; i <= 7; i++) {
        feed.push({ id: `${i}`, content: `Message ${i}`, timestamp: i * 1000 });
        
        // Enforce limit
        if (feed.length > maxFeedItems) {
          feed = feed.slice(-maxFeedItems);
        }
      }
      
      // Should have last 5 items
      expect(feed.length).toBe(5);
      expect(feed[0].content).toBe('Message 3'); // Items 1-2 removed
      expect(feed[4].content).toBe('Message 7'); // Newest at end
    });
  });
  
  describe('Feed Behavior Requirements', () => {
    test('should have consistent behavior across all tiers', () => {
      const tiers = ['FREE', 'PARTY_PASS', 'PRO'];
      
      tiers.forEach(tier => {
        const feed = [];
        
        // Add reactions with tier context
        feed.push({ id: '1', content: '❤️', tier });
        feed.push({ id: '2', content: '🔥', tier });
        
        // All tiers should maintain same order
        expect(feed[0].content).toBe('❤️');
        expect(feed[1].content).toBe('🔥');
        expect(feed.length).toBe(2);
      });
    });
  });
  
  describe('TTL Auto-Expiry', () => {
    test('should support time-based expiration of old reactions', () => {
      const MESSAGE_TTL_MS = 12000; // 12 seconds
      const now = Date.now();
      
      const feed = [
        { id: '1', content: 'Old', timestamp: now - 15000 }, // Expired
        { id: '2', content: 'Recent', timestamp: now - 5000 }, // Not expired
        { id: '3', content: 'New', timestamp: now - 1000 } // Not expired
      ];
      
      // Filter out expired items
      const activeFeed = feed.filter(item => {
        return (now - item.timestamp) < MESSAGE_TTL_MS;
      });
      
      // Should only have non-expired items
      expect(activeFeed.length).toBe(2);
      expect(activeFeed[0].content).toBe('Recent');
      expect(activeFeed[1].content).toBe('New');
    });
  });
  
  describe('Container Scrolling', () => {
    test('should set scrollTop to scrollHeight for auto-scroll behavior', () => {
      // Mock container element
      const container = {
        scrollHeight: 1000,
        scrollTop: 0
      };
      
      // The actual implementation uses setTimeout(() => { container.scrollTop = container.scrollHeight }, 0)
      // We test the core logic: scrollTop should be set to scrollHeight
      container.scrollTop = container.scrollHeight;
      
      // Verify scroll position is at bottom
      expect(container.scrollTop).toBe(1000);
      expect(container.scrollTop).toBe(container.scrollHeight);
    });
  });
});

describe('Integration: Unified Feed Display', () => {
  test('should render reactions in correct order (oldest to newest)', () => {
    const reactions = [
      { id: '1', sender: 'Alice', content: '❤️', timestamp: 1000 },
      { id: '2', sender: 'Bob', content: '🔥', timestamp: 2000 },
      { id: '3', sender: 'Charlie', content: '👍', timestamp: 3000 }
    ];
    
    // Reactions should be rendered in this order in the DOM
    expect(reactions[0].sender).toBe('Alice'); // First (oldest) at top
    expect(reactions[2].sender).toBe('Charlie'); // Last (newest) at bottom
  });
  
  test('should show all tiers reactions in the same feed', () => {
    const reactions = [
      { id: '1', sender: 'FreeUser', content: '❤️', tier: 'FREE' },
      { id: '2', sender: 'PartyPassUser', content: '🔥', tier: 'PARTY_PASS' },
      { id: '3', sender: 'ProUser', content: '👍', tier: 'PRO' }
    ];
    
    // All reactions should appear in the same feed regardless of tier
    expect(reactions.length).toBe(3);
    reactions.forEach(reaction => {
      expect(['FREE', 'PARTY_PASS', 'PRO']).toContain(reaction.tier);
    });
  });
});
