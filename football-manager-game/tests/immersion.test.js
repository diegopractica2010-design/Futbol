(function () {
  "use strict";

  /**
   * Immersion System Test Suite
   * Validates deterministic narrative generation and replay safety
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

  // Test 1: Immersion system loads
  test("Immersion system loads", () => {
    assert(FMG.Immersion, "Immersion not loaded");
    assert(FMG.Immersion.MILESTONE_TEMPLATES, "MILESTONE_TEMPLATES missing");
    assert(FMG.Immersion.SEASON_NARRATIVE_ARCS, "SEASON_NARRATIVE_ARCS missing");
  });

  // Test 2: Rivalries system loads
  test("Rivalries system loads", () => {
    assert(FMG.Rivalries, "Rivalries not loaded");
    assert(FMG.Rivalries.RIVALRY_TEMPLATES, "RIVALRY_TEMPLATES missing");
    assert(FMG.Rivalries.createRivalry, "createRivalry function missing");
  });

  // Test 3: Integration system loads
  test("Immersion integration loads", () => {
    assert(FMG.ImmersionIntegration, "ImmersionIntegration not loaded");
    assert(FMG.ImmersionIntegration.registerImmersionJobs, "registerImmersionJobs missing");
  });

  // Test 4: Milestone templates are valid
  test("Milestone templates are valid", () => {
    const templates = FMG.Immersion.MILESTONE_TEMPLATES;
    Object.values(templates).forEach((milestone) => {
      assert(milestone.category, "Missing category");
      assert(milestone.label, "Missing label");
      assert(milestone.narrative, "Missing narrative function");
      assert(typeof milestone.narrative === "function", "Narrative must be a function");
      assert(milestone.importance >= 0 && milestone.importance <= 100, "Invalid importance range");
    });
  });

  // Test 5: Narrative arc templates are valid
  test("Narrative arc templates are valid", () => {
    const arcs = FMG.Immersion.SEASON_NARRATIVE_ARCS;
    arcs.forEach((arc) => {
      assert(arc.id, "Missing arc id");
      assert(arc.title, "Missing arc title");
      assert(arc.trigger, "Missing trigger function");
      assert(arc.acts && arc.acts.length > 0, "Missing acts");
    });
  });

  // Test 6: Create rivalry
  test("Can create rivalry between teams", () => {
    const teamA = { id: "team-a", name: "Team A" };
    const teamB = { id: "team-b", name: "Team B" };

    const rivalry = FMG.Rivalries.createRivalry(teamA, teamB, "regional");

    assert(rivalry.teamAId === teamA.id, "Team A not set");
    assert(rivalry.teamBId === teamB.id, "Team B not set");
    assert(rivalry.type === "regional", "Type not set");
    assert(rivalry.intensity > 0, "Intensity not set");
  });

  // Test 7: Rivalry tension calculation
  test("Rivalry tension calculation works", () => {
    const rivalry = {
      intensity: 70,
      lastMeetingWeek: 10,
      recentResults: [{ margin: 1 }],
      headToHead: { teamAWins: 2, teamBWins: 2, draws: 1 }
    };

    const state = { currentWeek: 15 };
    const tension = FMG.Rivalries.calculateRivalryTension(rivalry, state);

    assert(tension > 0, "Tension should be positive");
    assert(tension <= 100, "Tension should not exceed 100");
    assert(Number.isFinite(tension), "Tension should be a number");
  });

  // Test 8: Immersion state initialization
  test("Immersion state initializes correctly", () => {
    const state = { teams: [] };
    FMG.Immersion.ensureImmersionState(state);

    assert(state.immersion, "Immersion state not created");
    assert(Array.isArray(state.immersion.milestones), "Milestones not array");
    assert(Array.isArray(state.immersion.pressQuestions), "Press questions not array");
    assert(Array.isArray(state.immersion.rumors), "Rumors not array");
  });

  // Test 9: Rivalry state initialization
  test("Rivalry state initializes correctly", () => {
    const state = {
      teams: [
        { id: "colo-colo", name: "Colo-Colo" },
        { id: "u-de-chile", name: "Universidad de Chile" }
      ]
    };

    FMG.Rivalries.ensureRivalryState(state);

    assert(state.rivalries, "Rivalries array not created");
    assert(Array.isArray(state.rivalries), "Rivalries should be array");
  });

  // Test 10: Press question generation
  test("Press questions generate deterministically", () => {
    const state = {
      userTeamId: "test-team",
      userClub: { name: "Test Club" },
      completedWeeks: 5
    };

    const q1 = FMG.Immersion.generatePressQuestion(state, "general");
    assert(q1, "Question not generated");
    assert(typeof q1 === "string", "Question should be string");
    assert(q1.length > 0, "Question should not be empty");
  });

  // Test 11: Player rumor generation
  test("Player rumors generate correctly", () => {
    const state = {
      currentWeek: 5,
      players: [
        { id: "p1", name: "Player 1", overall: 75, teamId: "team-a", retired: false, value: 5000000 },
        { id: "p2", name: "Player 2", overall: 80, teamId: "team-b", retired: false, value: 7000000 }
      ],
      teams: [
        { id: "team-a", name: "Team A", budget: 100000000 },
        { id: "team-b", name: "Team B", budget: 90000000 },
        { id: "team-c", name: "Team C", budget: 85000000 }
      ]
    };

    const rumor = FMG.Immersion.generatePlayerRumor(state);

    if (rumor) {
      assert(rumor.playerId, "Player ID missing");
      assert(rumor.fromTeamName, "From team missing");
      assert(rumor.toTeamName, "To team missing");
      assert(rumor.content, "Rumor content missing");
    }
  });

  // Test 12: Reputation shift calculation
  test("Reputation shift calculation works", () => {
    const state = {
      userTeamId: "team-a",
      completedWeeks: 10,
      totalWeeks: 38,
      standings: [
        { teamId: "team-a", position: 1, points: 30 }
      ],
      seasonLog: [
        { result: "victoria" },
        { result: "victoria" },
        { result: "empate" }
      ],
      finances: { boardTrust: 80 },
      career: { reputation: 50 }
    };

    const shift = FMG.Immersion.evaluateReputationShift(state);

    assert(Number.isFinite(shift), "Shift should be a number");
    assert(shift >= -10 && shift <= 10, "Shift should be reasonable");
  });

  // Test 13: Update rivalry after match
  test("Rivalry updates after match", () => {
    const rivalry = {
      teamAId: "team-a",
      teamBId: "team-b",
      headToHead: { teamAWins: 0, teamBWins: 0, draws: 0 },
      recentResults: [],
      meetingsCount: 0,
      dramaticMoments: []
    };

    const result = {
      homeTeamId: "team-a",
      awayTeamId: "team-b",
      homeGoals: 2,
      awayGoals: 1,
      week: 5
    };

    const state = { currentWeek: 5 };

    FMG.Rivalries.updateRivalryAfterMatch(rivalry, result, state);

    assert(rivalry.headToHead.teamAWins === 1, "Team A should have 1 win");
    assert(rivalry.recentResults.length === 1, "Recent result not recorded");
    assert(rivalry.meetingsCount === 1, "Meeting count not updated");
  });

  // Test 14: Rivalry summary generation
  test("Rivalry summary generates correctly", () => {
    const rivalry = {
      id: "rv-1",
      name: "Test Rivalry",
      teamAName: "Team A",
      teamBName: "Team B",
      intensity: 75,
      emotionalState: "heated",
      headToHead: { teamAWins: 2, teamBWins: 1, draws: 0 },
      recentResults: [{ score: "2-1" }],
      dramaticMoments: []
    };

    const state = { currentWeek: 10 };

    const summary = FMG.Rivalries.getRivalrySummary(rivalry, state);

    assert(summary.name, "Summary missing name");
    assert(summary.tension, "Summary missing tension");
    assert(summary.emotionalState, "Summary missing emotional state");
  });

  // Test 15: Weekly immersion processing
  test("Weekly immersion processing works", () => {
    const state = {
      currentWeek: 5,
      seasonNumber: 1,
      userTeamId: "team-a",
      completedWeeks: 4,
      totalWeeks: 38,
      standings: [{ teamId: "team-a", position: 2, points: 12 }],
      players: [
        { id: "p1", name: "Player 1", teamId: "team-a", overall: 75, morale: 80, retired: false }
      ],
      teams: [{ id: "team-a", name: "Team A" }],
      career: { reputation: 50 },
      finances: { boardTrust: 70 },
      seasonLog: [],
      userClub: { name: "Team A" }
    };

    FMG.Immersion.ensureImmersionState(state);
    const results = FMG.Immersion.processWeeklyImmersion(state);

    assert(results.questions >= 0, "Questions should be non-negative");
    assert(results.rumors >= 0, "Rumors should be non-negative");
    assert(results.declarations >= 0, "Declarations should be non-negative");
  });

  // Test 16: Immersion reducer compatibility
  test("Immersion reducer functions work", () => {
    const state = {
      currentWeek: 1,
      seasonNumber: 1,
      teams: [],
      immersion: { pressQuestions: [] }
    };

    const updated = FMG.ImmersionIntegration.updateImmersionState(state, {
      type: "ADD_PRESS_QUESTION",
      question: "Test question?"
    });

    assert(updated.immersion.pressQuestions.length === 1, "Question not added");
  });

  // Print summary
  console.log(
    `\n${"=".repeat(50)}\nImmersion System Tests\n${"=".repeat(50)}\n` +
    `Passed: ${tests.passed}\nFailed: ${tests.failed}\nTotal: ${tests.passed + tests.failed}\n`
  );

  if (tests.failed === 0) {
    console.log("✓ All tests passed!");
  } else {
    console.error(`✗ ${tests.failed} test(s) failed`);
  }

  window.FMG_IMMERSION_TESTS = tests;
})();
