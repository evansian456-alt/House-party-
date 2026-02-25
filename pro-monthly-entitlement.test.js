/**
 * @jest-environment node
 */

const request = require("supertest");
const WebSocket = require("ws");
const { app, waitForRedis, redis, parties } = require("./server");

describe("PRO_MONTHLY Party Pass Entitlement", () => {
  // Wait for Redis to be ready before running any tests
  beforeAll(async () => {
    try {
      await waitForRedis();
    } catch (error) {
      console.error('Failed to connect to Redis:', error.message);
    }
  });

  // Clear parties and Redis before each test to ensure clean state
  beforeEach(async () => {
    parties.clear();
    // Clear Redis mock
    if (redis) {
      await redis.flushall();
    }
  });
  
  describe("Server-side Party Pass entitlement (isPartyPassActive)", () => {
    it("should treat PRO_MONTHLY tier as having Party Pass", async () => {
      // Create party with PRO_MONTHLY tier in prototype mode
      const response = await request(app)
        .post("/api/create-party")
        .send({
          djName: "DJ Pro Monthly",
          source: "local",
          prototypeMode: true,
          tier: "PRO_MONTHLY"
        })
        .expect(200);
      
      const { partyCode } = response.body;
      
      // Get party state
      const stateResponse = await request(app)
        .get(`/api/party-state?code=${partyCode}`)
        .expect(200);
      
      // Verify tier info includes PRO_MONTHLY
      expect(stateResponse.body.tierInfo.tier).toBe("PRO_MONTHLY");
      expect(stateResponse.body.tierInfo.maxPhones).toBe(10);
      expect(stateResponse.body.tierInfo.partyPassExpiresAt).toBeTruthy();
    });
    
    it("should treat PARTY_PASS tier as having Party Pass when not expired", async () => {
      // Create party with PARTY_PASS tier in prototype mode
      const response = await request(app)
        .post("/api/create-party")
        .send({
          djName: "DJ Party Pass",
          source: "local",
          prototypeMode: true,
          tier: "PARTY_PASS"
        })
        .expect(200);
      
      const { partyCode } = response.body;
      
      // Get party state
      const stateResponse = await request(app)
        .get(`/api/party-state?code=${partyCode}`)
        .expect(200);
      
      // Verify tier info
      expect(stateResponse.body.tierInfo.tier).toBe("PARTY_PASS");
      expect(stateResponse.body.tierInfo.maxPhones).toBe(4);
      expect(stateResponse.body.tierInfo.partyPassExpiresAt).toBeTruthy();
    });
    
    it("should NOT treat FREE tier as having Party Pass", async () => {
      // Create party with FREE tier in prototype mode
      const response = await request(app)
        .post("/api/create-party")
        .send({
          djName: "DJ Free",
          source: "local",
          prototypeMode: true,
          tier: "FREE"
        })
        .expect(200);
      
      const { partyCode } = response.body;
      
      // Get party state
      const stateResponse = await request(app)
        .get(`/api/party-state?code=${partyCode}`)
        .expect(200);
      
      // Verify tier info
      expect(stateResponse.body.tierInfo.tier).toBe("FREE");
      expect(stateResponse.body.tierInfo.maxPhones).toBeNull(); // FREE tier has null maxPhones (defaults to 2)
      expect(stateResponse.body.tierInfo.partyPassExpiresAt).toBeNull();
    });
  });
  
  describe("Tier validation for prototype mode", () => {
    it("should accept PRO_MONTHLY as valid tier", async () => {
      const response = await request(app)
        .post("/api/create-party")
        .send({
          djName: "DJ Test",
          source: "local",
          prototypeMode: true,
          tier: "PRO_MONTHLY"
        })
        .expect(200);
      
      expect(response.body).toHaveProperty("partyCode");
    });
    
    it("should accept PRO as valid tier (alias for PRO_MONTHLY)", async () => {
      const response = await request(app)
        .post("/api/create-party")
        .send({
          djName: "DJ Test",
          source: "local",
          prototypeMode: true,
          tier: "PRO"
        })
        .expect(200);
      
      expect(response.body).toHaveProperty("partyCode");
    });
    
    it("should reject invalid tier", async () => {
      const response = await request(app)
        .post("/api/create-party")
        .send({
          djName: "DJ Test",
          source: "local",
          prototypeMode: true,
          tier: "INVALID_TIER"
        })
        .expect(400);
      
      expect(response.body.error).toContain("Invalid tier");
    });
  });
  
  describe("Party Pass expiration handling", () => {
    it("should set 30-day expiration for PRO_MONTHLY", async () => {
      const response = await request(app)
        .post("/api/create-party")
        .send({
          djName: "DJ Pro",
          source: "local",
          prototypeMode: true,
          tier: "PRO_MONTHLY"
        })
        .expect(200);
      
      const { partyCode } = response.body;
      
      // Get party state
      const stateResponse = await request(app)
        .get(`/api/party-state?code=${partyCode}`)
        .expect(200);
      
      const expiresAt = stateResponse.body.tierInfo.partyPassExpiresAt;
      const now = Date.now();
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      
      // Verify expiration is set to approximately 30 days from now
      expect(expiresAt).toBeTruthy();
      expect(expiresAt).toBeGreaterThan(now + thirtyDays - 1000); // Within 1 second tolerance
      expect(expiresAt).toBeLessThan(now + thirtyDays + 1000);
    });
    
    it("should set 2-hour expiration for PARTY_PASS", async () => {
      const response = await request(app)
        .post("/api/create-party")
        .send({
          djName: "DJ Party",
          source: "local",
          prototypeMode: true,
          tier: "PARTY_PASS"
        })
        .expect(200);
      
      const { partyCode } = response.body;
      
      // Get party state
      const stateResponse = await request(app)
        .get(`/api/party-state?code=${partyCode}`)
        .expect(200);
      
      const expiresAt = stateResponse.body.tierInfo.partyPassExpiresAt;
      const now = Date.now();
      const twoHours = 2 * 60 * 60 * 1000;
      
      // Verify expiration is set to approximately 2 hours from now
      expect(expiresAt).toBeTruthy();
      expect(expiresAt).toBeGreaterThan(now + twoHours - 1000); // Within 1 second tolerance
      expect(expiresAt).toBeLessThan(now + twoHours + 1000);
    });
  });
});
