const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

global.window = {};
global.localStorage = {
  data: {},
  setItem(key, value) { this.data[key] = value; },
  getItem(key) { return this.data[key] || null; }
};

[
  "src/utils.js",
  "src/gameState.js",
  "src/table.js",
  "src/squad.js",
  "src/matchEngine.js",
  "src/finances.js",
  "src/events.js",
  "src/transfers.js",
  "src/gameEngine.js"
].forEach((file) => {
  vm.runInThisContext(fs.readFileSync(path.join(root, file), "utf8"), { filename: file });
});

const FMG = window.FMG;
const teams = JSON.parse(fs.readFileSync(path.join(root, "data/teams.json"), "utf8"));
const players = JSON.parse(fs.readFileSync(path.join(root, "data/players.json"), "utf8"));

FMG.initializeGame(teams, players);
FMG.selectClub("colo-colo");

assert.ok(FMG.gameState.version >= 6, "fase 6 debe usar estado versionado desde 6");
assert.ok(Array.isArray(FMG.gameState.market.negotiations), "mercado debe tener negociaciones");
assert.ok(Array.isArray(FMG.gameState.market.incomingOffers), "mercado debe tener ofertas recibidas");
assert.ok(Array.isArray(FMG.gameState.market.transferHistory), "mercado debe tener historial");

const targetListing = FMG.gameState.market.listings.find((listing) => listing.askingPrice > 0);
assert.ok(targetListing, "debe existir jugador negociable");
const target = FMG.gameState.players.find((player) => player.id === targetListing.playerId);
const dynamicValue = FMG.calculatePlayerValue(target);
assert.ok(dynamicValue > 0, "valor dinamico debe ser positivo");
assert.ok(FMG.estimatePlayerWageDemand(target, "starter") > target.salary, "demanda salarial titular debe superar salario base");

const lowOffer = FMG.createTransferOffer(FMG.gameState, target.id, {
  transferType: "buy",
  fee: Math.round(targetListing.askingPrice * 0.4),
  wage: Math.round(target.salary * 0.4),
  role: "starter",
  years: 3
});
assert.equal(lowOffer.ok, true, "debe crear oferta baja");
const counter = FMG.resolveTransferNegotiation(FMG.gameState, lowOffer.negotiation.id);
assert.equal(counter.ok, false, "oferta baja debe generar rechazo o contraoferta");
assert.equal(FMG.gameState.market.negotiations[0].status, "countered", "oferta baja debe quedar contraofertada");

const goodOffer = FMG.createTransferOffer(FMG.gameState, target.id, {
  transferType: "buy",
  fee: targetListing.askingPrice,
  wage: FMG.estimatePlayerWageDemand(target, "starter"),
  role: "starter",
  years: 4
});
assert.equal(goodOffer.ok, true, "debe crear oferta aceptable");
const balanceBefore = FMG.gameState.finances.balance;
const resolved = FMG.resolveTransferNegotiation(FMG.gameState, goodOffer.negotiation.id);
assert.equal(resolved.ok, true, "oferta aceptable debe cerrar fichaje");
assert.equal(target.teamId, FMG.gameState.userTeamId, "jugador fichado debe llegar al club");
assert.equal(target.contractYears, 4, "contrato negociado debe quedar guardado");
assert.equal(target.squadRole, "starter", "rol negociado debe quedar guardado");
assert.ok(FMG.gameState.finances.balance < balanceBefore, "fichaje debe descontar presupuesto");
assert.ok(FMG.gameState.market.transferHistory.some((entry) => entry.playerId === target.id), "fichaje debe ir al historial");

const freeAgent = FMG.gameState.players.find((player) => player.teamId !== FMG.gameState.userTeamId && !player.retired);
freeAgent.teamId = "free-agent";
freeAgent.contractYears = 0;
FMG.buildTransferMarket(FMG.gameState);
const freeListing = FMG.gameState.market.listings.find((listing) => listing.playerId === freeAgent.id);
assert.ok(freeListing && freeListing.askingPrice === 0, "jugador libre debe aparecer sin prima");
const freeOffer = FMG.createTransferOffer(FMG.gameState, freeAgent.id, {
  transferType: "free",
  wage: FMG.estimatePlayerWageDemand(freeAgent, "rotation"),
  role: "rotation",
  years: 2
});
assert.equal(freeOffer.ok, true, "debe negociar con jugador libre");
assert.equal(FMG.resolveTransferNegotiation(FMG.gameState, freeOffer.negotiation.id).ok, true, "jugador libre debe poder firmar");

const renewPlayer = FMG.gameState.players.find((player) => player.teamId === FMG.gameState.userTeamId && !player.retired);
const badRenewal = FMG.renewPlayerContract(FMG.gameState, renewPlayer.id, { wage: 1, years: 1, role: "key" });
assert.equal(badRenewal.ok, false, "renovacion baja debe ser rechazada");
const goodRenewal = FMG.renewPlayerContract(FMG.gameState, renewPlayer.id, {
  wage: FMG.estimatePlayerWageDemand(renewPlayer, "key"),
  years: 5,
  role: "key"
});
assert.equal(goodRenewal.ok, true, "renovacion correcta debe aceptarse");
assert.equal(renewPlayer.contractYears, 5, "renovacion debe actualizar anos");
assert.equal(renewPlayer.squadRole, "key", "renovacion debe actualizar rol");

const offers = FMG.generateIncomingOffers(FMG.gameState);
if (!offers.length) {
  const owned = FMG.gameState.players.find((player) => player.teamId === FMG.gameState.userTeamId && !player.retired);
  FMG.gameState.market.incomingOffers.unshift({
    id: "offer-test",
    playerId: owned.id,
    buyerTeamId: "u-de-chile",
    buyerTeamName: "Universidad de Chile",
    fee: FMG.calculatePlayerValue(owned),
    status: "pending",
    week: FMG.gameState.currentWeek
  });
}
const incoming = FMG.gameState.market.incomingOffers.find((offer) => offer.status === "pending");
assert.ok(incoming, "debe existir oferta recibida");
const saleBalance = FMG.gameState.finances.balance;
assert.equal(FMG.respondIncomingOffer(FMG.gameState, incoming.id, true).ok, true, "debe aceptar oferta recibida");
assert.ok(FMG.gameState.finances.balance > saleBalance, "venta debe aumentar saldo");

const save = FMG.saveGame();
assert.equal(save.ok, true, "debe guardar mercado avanzado");
const parsed = JSON.parse(localStorage.data[FMG.STORAGE_KEY]);
parsed.version = 5;
delete parsed.market.negotiations;
delete parsed.market.incomingOffers;
delete parsed.market.transferHistory;
localStorage.data[FMG.STORAGE_KEY] = JSON.stringify(parsed);
assert.equal(FMG.loadGame().ok, true, "debe migrar save anterior");
assert.ok(FMG.gameState.version >= 6, "save debe migrar a version 6 o superior");
assert.ok(Array.isArray(FMG.gameState.market.negotiations), "save migrado debe tener negociaciones");

console.log("Phase 6 tests passed");
