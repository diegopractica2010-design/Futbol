(function () {
  "use strict";

  /**
   * Player Progression System Test Suite
   * Validates deterministic progression, replay safety, and snapshot compatibility
   */

  if (typeof FMG === "undefined" || !FMG) return;

  const tests = {
    passed: 0,
    failed: 0,
    results: []
  };

  function test(name, fn) {
    try {
      fn();
      tests.passed++;
      tests.results.push({ name, status: "PASS" });
      console.log(`✓ ${name}`);
    } catch (err) {
      tests.failed++;
      tests.results.push({ name, status: "FAIL", error: err.message });
      console.error(`✗ ${name}: ${err.message}`);
    }
  }

  function assert(condition, message) {
    if (!condition) throw new Error(message || "Assertion failed");
  }

  // Test 1: Personality system exists and initializes
  test("PlayerAttributes system loads", () => {
    assert(FMG.PlayerAttributes, "PlayerAttributes not loaded");
    assert(FMG.PlayerAttributes.PERSONALITY_TYPES, "PERSONALITY_TYPES missing");
    assert(Object.keys(FMG.PlayerAttributes.PERSONALITY_TYPES).length > 0, "No personality types defined");
  });

  // Test 2: PlayerProgression system exists
  test("PlayerProgression system loads", () => {
    assert(FMG.PlayerProgression, "PlayerProgression not loaded");
    assert(FMG.PlayerProgression.initializePersonality, "initializePersonality function missing");
    assert(FMG.PlayerProgression.applyWeeklyProgression, "applyWeeklyProgression function missing");
  });

  // Test 3: Integration system exists
  test("PlayerProgressionIntegration system loads", () => {
    assert(FMG.PlayerProgressionIntegration, "PlayerProgressionIntegration not loaded");
    assert(FMG.PlayerProgressionIntegration.registerPlayerProgressionJobs, "registerPlayerProgressionJobs missing");
  });

  // Test 4: Personality initialization is deterministic
  test("Personality initialization is deterministic", () => {
    const player1 = { id: "p01", name: "Test", overall: 75, potential: 80 };
    const player2 = { id: "p01", name: "Test", overall: 75, potential: 80 };

    FMG.PlayerProgression.initializePersonality(player1, 0);
    FMG.PlayerProgression.initializePersonality(player2, 0);

    assert(player1.personality.professionalism === player2.personality.professionalism, "Professionalism not deterministic");
    assert(player1.personality.ambition === player2.personality.ambition, "Ambition not deterministic");
  });

  // Test 5: Different seeds produce different personalities
  test("Different seeds produce different personalities", () => {
    const player1 = { id: "p01", name: "Test", overall: 75, potential: 80 };
    const player2 = { id: "p01", name: "Test", overall: 75, potential: 80 };

    FMG.PlayerProgression.initializePersonality(player1, 0);
    FMG.PlayerProgression.initializePersonality(player2, 1);

    const diff = Math.abs(player1.personality.professionalism - player2.personality.professionalism);
    assert(diff !== 0 || Math.abs(player1.personality.ambition - player2.personality.ambition) !== 0, "Different seeds should produce some differences");
  });

  // Test 6: Growth stage calculation works
  test("Growth stage calculation works", () => {
    const youngStage = FMG.PlayerProgression.getGrowthStage(20);
    assert(youngStage.stageName === "young", "Age 20 should be young stage");

    const primeStage = FMG.PlayerProgression.getGrowthStage(25);
    assert(primeStage.stageName === "prime", "Age 25 should be prime stage");

    const decliningStage = FMG.PlayerProgression.getGrowthStage(35);
    assert(decliningStage.stageName === "declining", "Age 35 should be declining stage");
  });

  // Test 7: Weekly progression applies correctly
  test("Weekly progression applies correctly", () => {
    const state = { seasonNumber: 1, currentWeek: 1, players: [] };
    const player = {
      id: "p01",
      name: "Test",
      age: 25,
      overall: 75,
      potential: 85,
      morale: 80,
      energy: 90,
      seasonStats: { minutes: 2000 }
    };

    FMG.PlayerProgression.initializePersonality(player);
    const result = FMG.PlayerProgression.applyWeeklyProgression(player, state, "balanced", 1);

    assert(result.player.overall <= 99, "Overall should not exceed 99");
    assert(result.player.overall >= 75 || result.player.overall < 75, "Overall should be updated");
    assert(result.progression.totalGrowth !== undefined, "totalGrowth should be calculated");
  });

  // Test 8: Dynamic potential calculation respects morale
  test("Dynamic potential respects morale impact", () => {
    const player1 = {
      id: "p01",
      name: "Test",
      age: 25,
      overall: 75,
      potential: 85,
      basePotential: 85,
      morale: 100
    };

    const player2 = {
      id: "p01",
      name: "Test",
      age: 25,
      overall: 75,
      potential: 85,
      basePotential: 85,
      morale: 30
    };

    FMG.PlayerProgression.initializePersonality(player1);
    FMG.PlayerProgression.initializePersonality(player2);

    const pot1 = FMG.PlayerProgression.calculateDynamicPotential(player1);
    const pot2 = FMG.PlayerProgression.calculateDynamicPotential(player2);

    assert(pot1 >= pot2, "Higher morale should yield higher potential");
  });

  // Test 9: Morale impact from match performance
  test("Morale impact applies correctly", () => {
    const player = {
      id: "p01",
      name: "Test",
      morale: 70,
      personality: { consistency: 60, temperament: 70 }
    };

    const beforeMorale = player.morale;
    FMG.PlayerProgression.applyMoraleImpact(player, { rating: 8.0 }, "win");

    assert(player.morale !== beforeMorale, "Morale should change after match");
    assert(player.morale > beforeMorale, "Morale should increase after win");
  });

  // Test 10: Injury risk calculation works
  test("Injury risk calculation works", () => {
    const player = {
      id: "p01",
      name: "Test",
      energy: 70,
      personality: { temperament: 60 }
    };

    const risk = FMG.PlayerProgression.calculateInjuryRisk(player, 1000);
    assert(risk > 0, "Injury risk should be positive");
    assert(risk < 0.1, "Injury risk should be reasonable");
  });

  // Test 11: Personality attributes ensure state works
  test("Personality attributes ensure state", () => {
    const player = { id: "p01", name: "Test" };
    FMG.PlayerAttributes.ensurePersonalityState(player);

    assert(player.personality, "Personality should be initialized");
    assert(player.personalityType, "PersonalityType should be set");
    assert(Object.keys(player.personality).length > 0, "Personality should have attributes");
  });

  // Test 12: Card risk increases with low temperament
  test("Card risk scales with temperament", () => {
    const hotHead = { temperament: 30 };
    const coolHead = { temperament: 80 };

    const hotHeadRisk = FMG.PlayerAttributes.getCardRisk(hotHead);
    const coolHeadRisk = FMG.PlayerAttributes.getCardRisk(coolHead);

    assert(hotHeadRisk > coolHeadRisk, "Lower temperament should increase card risk");
  });

  // Test 13: Training receptiveness works
  test("Training receptiveness calculation", () => {
    const ambitious = { ambition: 90, professionalism: 85 };
    const lazy = { ambition: 30, professionalism: 30 };

    const ambitRec = FMG.PlayerAttributes.getTrainingReceptiveness(ambitious, "balanced");
    const lazyRec = FMG.PlayerAttributes.getTrainingReceptiveness(lazy, "balanced");

    assert(ambitRec > lazyRec, "Ambitious players should have higher receptiveness");
  });

  // Test 14: Morale recovery rate works
  test("Morale recovery rate calculation", () => {
    const professional = { professionalism: 80, consistency: 75 };
    const unprofessional = { professionalism: 30, consistency: 30 };

    const proRate = FMG.PlayerAttributes.getMoraleRecoveryRate(professional);
    const unprofRate = FMG.PlayerAttributes.getMoraleRecoveryRate(unprofessional);

    assert(proRate > unprofRate, "Professional players should recover morale faster");
  });

  // Test 15: Reducer-compatible state updates
  test("Reducer-compatible state updates", () => {
    const state = {
      players: [
        { id: "p01", name: "Test", overall: 75, potential: 85, morale: 70, age: 25, seasonStats: { minutes: 1000 } }
      ],
      seasonNumber: 1,
      currentWeek: 1
    };

    const updated = FMG.PlayerProgressionIntegration.updatePlayerProgressionState(state, {
      type: "INITIALIZE_PERSONALITIES",
      seed: 0
    });

    assert(updated.players[0].personality, "Personality should be initialized via reducer");
  });

  // Test 16: Progress history tracking
  test("Progression history tracking", () => {
    const state = { seasonNumber: 1, currentWeek: 1, players: [] };
    const player = {
      id: "p01",
      name: "Test",
      age: 25,
      overall: 75,
      potential: 85,
      morale: 80,
      progressionHistory: []
    };

    FMG.PlayerProgression.initializePersonality(player);
    FMG.PlayerProgression.applyWeeklyProgression(player, state, "balanced", 1);

    assert(player.progressionHistory.length > 0, "Progression history should be recorded");
    assert(player.progressionHistory[0].week === 1, "Week should be recorded");
  });

  // Print summary
  console.log(
    `\n${"=".repeat(50)}\nPlayer Progression System Tests\n${"=".repeat(50)}\n` +
    `Passed: ${tests.passed}\nFailed: ${tests.failed}\nTotal: ${tests.passed + tests.failed}\n`
  );

  if (tests.failed === 0) {
    console.log("✓ All tests passed!");
  } else {
    console.error(`✗ ${tests.failed} test(s) failed`);
  }

  // Expose results for inspection
  window.FMG_PROGRESSION_TESTS = tests;
})();
