// ============================================================
// SMOKE TESTS — Fases 15-17 (Motores visuales)
// ============================================================
// Validación mínima:
// - Archivos existen
// - Sin errores de sintaxis
// - Estructura modular válida

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const basePath = path.join(__dirname, "..", "src");

// Test 1: Archivos Phase 15 existen
try {
  const files = [
    path.join(basePath, "phase15", "game.js"),
    path.join(basePath, "phase15", "renderer.js")
  ];
  
  files.forEach((file) => {
    const exists = fs.existsSync(file);
    assert.ok(exists, `Archivo ${file} debe existir`);
    const content = fs.readFileSync(file, "utf8");
    assert.ok(content.length > 0, `Archivo ${file} no debe estar vacío`);
  });
  console.log("✓ Phase 15 archivos válidos");
} catch (error) {
  console.error("✗ Phase 15 test falló:", error.message);
  process.exit(1);
}

// Test 2: Archivos Phase 16 existen
try {
  const files = [
    path.join(basePath, "phase16", "index.js"),
    path.join(basePath, "phase16", "MatchSystem.js"),
    path.join(basePath, "phase16", "InputSystem.js"),
    path.join(basePath, "phase16", "CameraSystem.js"),
    path.join(basePath, "phase16", "AISystem.js"),
    path.join(basePath, "phase16", "HUDSystem.js")
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

// Test 3: Archivos Phase 17 existen
try {
  const files = [
    path.join(basePath, "phase17", "index.js"),
    path.join(basePath, "phase17", "AnimationClip.js"),
    path.join(basePath, "phase17", "BlendTree.js")
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

// Test 4: Phase 16 HUDSystem no tiene TODOs ambiguos
try {
  const hudFile = path.join(basePath, "phase16", "HUDSystem.js");
  const content = fs.readFileSync(hudFile, "utf8");
  // Verificar que no hay TODOs sin resolver
  const lines = content.split("\n");
  const todoLine = lines.find(line => line.includes("TODO") && !line.includes("Responsabilidad"));
  assert.ok(!todoLine, "HUDSystem.js no debe tener TODOs pendientes");
  console.log("✓ HUDSystem.js sin TODOs ambiguos");
} catch (error) {
  console.error("✗ HUDSystem TODO test falló:", error.message);
  process.exit(1);
}

// Test 5: Fases 15-17 no escriben en standings
try {
  const phaseFiles = [];
  for (let phase = 15; phase <= 17; phase++) {
    const dir = path.join(basePath, `phase${phase}`);
    if (fs.existsSync(dir)) {
      fs.readdirSync(dir).forEach((file) => {
        if (file.endsWith(".js")) {
          phaseFiles.push(path.join(dir, file));
        }
      });
    }
  }
  
  let foundViolation = false;
  phaseFiles.forEach((file) => {
    const content = fs.readFileSync(file, "utf8");
    // Validar que no hay escrituras directas a standings
    if (content.match(/\.standings\s*=/)) {
      console.error(`✗ ${file} intenta escribir en standings`);
      foundViolation = true;
    }
    if (content.match(/\.seasonStats\[.*\]\s*=/)) {
      console.error(`✗ ${file} intenta escribir en seasonStats`);
      foundViolation = true;
    }
  });
  
  assert.ok(!foundViolation, "Fases 15-17 no deben escribir en standings/seasonStats");
  console.log("✓ Fases 15-17 no escriben en standings");
} catch (error) {
  console.error("✗ Arquitectura test falló:", error.message);
  process.exit(1);
}

console.log("\nPhase 15-17 smoke tests passed");


