const { spawnSync } = require("child_process");

const tests = [
  "tests/initialization.test.js",
  "tests/squad_management.test.js",
  "tests/match_engine.test.js",
  "tests/live_match_flow.test.js",
  "tests/tactics_formation.test.js",
  "tests/player_attributes.test.js",
  "tests/transfer_market.test.js",
  "tests/rival_ai.test.js",
  "tests/competitions.test.js",
  "tests/finances_budgets.test.js",
  "tests/manager_profile.test.js",
  "tests/news_system.test.js",
  "tests/club_identity.test.js",
  "tests/settings_config.test.js",
  "tests/managerEcosystem.test.js",
  "tests/worldMediaPressure.test.js",
  "tests/advancedTransferMarket.test.js",
  "tests/advancedYouthAcademy.test.js",
  "tests/squadPsychology.test.js",
  "tests/simulation_engine_smoke.test.js",
  "tests/simulation_broadcast_hud.test.js",
  "tests/simulation_tactics.test.js",
  "tests/performance_foundation.test.js",
  "tests/state_architecture.test.js",
  "tests/immutable_state.test.js",
  "tests/stabilization.test.js",
  "tests/hardening.test.js",
  "tests/deterministicRuntime.test.js",
  "tests/persistenceArchitecture.test.js",
  "tests/runtimeStressHarness.test.js",
  "tests/longTermWorldSimulation.test.js",
  "tests/pre_phase10_validation.test.js",
  "tests/pre_phase10_finalization.test.js",
  "tests/playerCareer.test.js",
  "tests/playerMode.test.js",
  "tests/sharedUniverse.test.js"
];

const failures = [];

for (const test of tests) {
  process.stdout.write(`\n[FMG test] ${test}\n`);
  const result = spawnSync(process.execPath, ["-r", "./tests/_esmBridge.js", test], { stdio: "inherit" });
  if (result.status !== 0) {
    failures.push({ test, status: result.status, signal: result.signal });
  }
}

process.stdout.write(`\n[FMG test summary] ${tests.length - failures.length}/${tests.length} passed\n`);

if (failures.length) {
  process.stderr.write("[FMG test failures]\n");
  failures.forEach((failure) => {
    process.stderr.write(`- ${failure.test} exited with ${failure.signal || failure.status}\n`);
  });
  process.exit(1);
}
