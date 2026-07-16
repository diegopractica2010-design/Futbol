// SharedUniverse — Tests CRUD básico
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// Mock IndexedDB con fake-indexeddb
const { IDBFactory } = require("fake-indexeddb");
globalThis.indexedDB = new IDBFactory();

globalThis.window = {};

const root = path.resolve(__dirname, "..");
const file = "persistence/sharedUniverse.js";
vm.runInThisContext(fs.readFileSync(path.join(root, file), "utf8"), { filename: file });

const SU = globalThis.window.FMG.SharedUniverse;

(async () => {
  try {
    // Test 1: init
    const initResult = await SU.init();
    assert.ok(initResult, "init debe retornar true");
    console.log("✓ initSharedUniverse");

    // Test 2: save and get character
    const char = { id: "test-1", name: "Jugador Test", club: "Colo-Colo" };
    const saveResult = await SU.saveCharacter(char);
    assert.ok(saveResult, "saveCharacter debe retornar true");
    const retrieved = await SU.getCharacter("test-1");
    assert.ok(retrieved, "getCharacter debe retornar el personaje");
    assert.equal(retrieved.name, "Jugador Test", "el nombre debe coincidir");
    assert.equal(retrieved.club, "Colo-Colo", "el club debe coincidir");
    console.log("✓ saveCharacter y getCharacter");

    // Test 3: get nonexistent
    const missing = await SU.getCharacter("no-existe");
    assert.equal(missing, null, "getCharacter de id inexistente debe retornar null");
    console.log("✓ getCharacter devuelve null para id inexistente");

    // Test 4: list characters
    const char2 = { id: "test-2", name: "Otro Jugador", club: "U de Chile" };
    await SU.saveCharacter(char2);
    const all = await SU.listCharacters();
    assert.ok(Array.isArray(all), "listCharacters debe retornar un array");
    assert.equal(all.length, 2, "debe haber 2 personajes");
    console.log("✓ listCharacters");

    // Test 5: update character
    char.name = "Jugador Test Editado";
    await SU.saveCharacter(char);
    const updated = await SU.getCharacter("test-1");
    assert.equal(updated.name, "Jugador Test Editado", "el nombre debe actualizarse");
    console.log("✓ updateCharacter");

    // Test 6: save without id throws
    try {
      await SU.saveCharacter({ name: "sin-id" });
      assert.fail("debe lanzar error");
    } catch (e) {
      assert.ok(e.message.includes("id"), "debe mencionar 'id' en el error");
    }
    console.log("✓ saveCharacter sin id lanza error");

    console.log("\nSharedUniverse tests passed");
  } catch (error) {
    console.error("✗ SharedUniverse test falló:", error.message);
    process.exit(1);
  }
})();
