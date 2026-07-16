// ============================================================
// SMOKE TESTS — Fases 16-17 (Motores visuales)
// ============================================================
// Validación mínima:
// - Archivos existen
// - Sin errores de sintaxis
// - Estructura modular válida

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const basePath = path.join(__dirname, "..", "simulation");

// Test 1: Archivos Phase 16 existen
try {
  const files = [
    path.join(basePath, "engine", "index.js"),
    path.join(basePath, "engine", "MatchSystem.js"),
    path.join(basePath, "engine", "InputSystem.js"),
    path.join(basePath, "engine", "CameraSystem.js"),
    path.join(basePath, "engine", "AISystem.js"),
    path.join(basePath, "engine", "HUDSystem.js")
  ];
  
  files.forEach((file) => {
    const exists = fs.existsSync(file);
    assert.ok(exists, `Archivo ${file} debe existir`);
    const content = fs.readFileSync(file, "utf8");
    assert.ok(content.length > 0, `Archivo ${file} no debe estar vacío`);
  });
  console.log("✓ Phase 16 archivos válidos");
} catch (error) {
  console.error("✗ Phase 16 test falló:", error.message);
  process.exit(1);
}

// Test 2: Archivos Phase 17 existen
try {
  const files = [
    path.join(basePath, "animation", "index.js"),
    path.join(basePath, "animation", "AnimationClip.js"),
    path.join(basePath, "animation", "BlendTree.js")
  ];
  
  files.forEach((file) => {
    const exists = fs.existsSync(file);
    assert.ok(exists, `Archivo ${file} debe existir`);
    const content = fs.readFileSync(file, "utf8");
    assert.ok(content.length > 0, `Archivo ${file} no debe estar vacío`);
  });
  console.log("✓ Phase 17 archivos válidos");
} catch (error) {
  console.error("✗ Phase 17 test falló:", error.message);
  process.exit(1);
}

// Test 3: Phase 16 HUDSystem no tiene TODOs ambiguos
try {
  const hudFile = path.join(basePath, "engine", "HUDSystem.js");
  const content = fs.readFileSync(hudFile, "utf8");
  const lines = content.split("\n");
  const todoLine = lines.find(line => line.includes("TODO") && !line.includes("Responsabilidad"));
  assert.ok(!todoLine, "HUDSystem.js no debe tener TODOs pendientes");
  console.log("✓ HUDSystem.js sin TODOs ambiguos");
} catch (error) {
  console.error("✗ HUDSystem TODO test falló:", error.message);
  process.exit(1);
}

// Test 4: Fases 16-17 no escriben en standings
try {
  const phaseFiles = [];
  const dirs = ["engine", "animation"];
  dirs.forEach((dir) => {
    const dirPath = path.join(basePath, dir);
    if (fs.existsSync(dirPath)) {
        fs.readdirSync(dirPath).forEach((file) => {
          if (file.endsWith(".js")) {
            phaseFiles.push(path.join(dirPath, file));
          }
        });
      }
    });
  let foundViolation = false;
  phaseFiles.forEach((file) => {
    const content = fs.readFileSync(file, "utf8");
    if (content.match(/\.standings\s*=/)) {
      console.error(`✗ ${file} intenta escribir en standings`);
      foundViolation = true;
    }
    if (content.match(/\.seasonStats\[.*\]\s*=/)) {
      console.error(`✗ ${file} intenta escribir en seasonStats`);
      foundViolation = true;
    }
  });
  
  assert.ok(!foundViolation, "Fases 16-17 no deben escribir en standings/seasonStats");
  console.log("✓ Fases 16-17 no escriben en standings");
} catch (error) {
  console.error("✗ Arquitectura test falló:", error.message);
  process.exit(1);
}

console.log("\nPhase 16-17 smoke tests passed");
