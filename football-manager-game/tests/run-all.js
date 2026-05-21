const { spawnSync } = require("child_process");

const tests = [
  "tests/phase0.test.js",
  "tests/phase1.test.js",
  "tests/phase2.test.js",
  "tests/phase3.test.js",
  "tests/phase4.test.js",
  "tests/phase5.test.js",
  "tests/phase6.test.js",
  "tests/phase7.test.js",
  "tests/phase8.test.js",
  "tests/phase9.test.js",
  "tests/phase10.test.js",
  "tests/phase11.test.js",
  "tests/phase12.test.js",
  "tests/phase13.test.js",
  "tests/managerEcosystem.test.js",
  "tests/worldMediaPressure.test.js",
  "tests/advancedTransferMarket.test.js",
  "tests/advancedYouthAcademy.test.js",
  "tests/squadPsychology.test.js",
  "tests/phase15_16_17_smoke.test.js",
  "tests/phase19_22.test.js",
  "tests/phase24.test.js",
  "tests/performance_foundation.test.js",
  "tests/phase2_architecture.test.js",
  "tests/immutable_state.test.js",
  "tests/stabilization.test.js",
  "tests/hardening.test.js",
  "tests/deterministicRuntime.test.js",
  "tests/persistenceArchitecture.test.js",
  "tests/runtimeStressHarness.test.js",
  "tests/longTermWorldSimulation.test.js",
  "tests/pre_phase10_validation.test.js",
  "tests/pre_phase10_finalization.test.js",
  "tests/playerCareer.test.js"
];

const failures = [];

for (const test of tests) {
  process.stdout.write(`\n[FMG test] ${test}\n`);
  const result = spawnSync(process.execPath, [test], { stdio: "inherit" });
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
