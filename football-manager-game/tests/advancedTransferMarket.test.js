const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

global.window = {};
global.localStorage = {
  data: {},
  setItem(key, value) { this.data[key] = value; },
  getItem(key) { return this.data[key] || null; },
  removeItem(key) { delete this.data[key]; }
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
  "src/career.js",
  "src/news.js",
  "src/presentation.js",
  "src/saveSystem.js",
  "src/managerEcosystem.js",
  "src/worldMediaPressure.js",
  "src/advancedTransferMarket.js",
  "src/gameEngine.js"
].forEach((file) => {
  vm.runInThisContext(fs.readFileSync(path.join(root, file), "utf8"), { filename: file });
});

const FMG = window.FMG;
const teams = JSON.parse(fs.readFileSync(path.join(root, "data/teams.json"), "utf8"));
const players = JSON.parse(fs.readFileSync(path.join(root, "data/players.json"), "utf8"));

FMG.initializeGame(teams, players);
FMG.selectClub("colo-colo");

const advanced = FMG.ensureAdvancedTransferMarket(FMG.gameState);
assert.ok(advanced.economy, "advanced market economy should be initialized");
assert.ok(advanced.clubs["colo-colo"], "club negotiation identity should be initialized");
assert.ok(advanced.contracts.wageHierarchy.length > 0, "wage hierarchy should be calculated");

FMG.gameState.currentWeek = 4;
FMG.gameState.market.windowOpen = true;
FMG.buildTransferMarket(FMG.gameState);
const firstListings = FMG.gameState.market.listings.map((item) => `${item.playerId}:${item.askingPrice}`).join("|");
FMG.buildTransferMarket(FMG.gameState);
const secondListings = FMG.gameState.market.listings.map((item) => `${item.playerId}:${item.askingPrice}`).join("|");
assert.equal(firstListings, secondListings, "advanced listings should be deterministic for same week");
assert.ok(FMG.gameState.market.listings.some((item) => Number.isFinite(item.marketHeat)), "listings should include market heat");

const targetListing = FMG.gameState.market.listings.find((listing) => listing.askingPrice > 0);
assert.ok(targetListing, "market should expose at least one buy target");
const target = FMG.gameState.players.find((player) => player.id === targetListing.playerId);
const offer = FMG.createTransferOffer(FMG.gameState, target.id, {
  transferType: "buy",
  fee: Math.round(targetListing.askingPrice * 0.25),
  wage: Math.round(FMG.estimatePlayerWageDemand(target, "rotation") * 0.55),
  role: "rotation"
});
assert.equal(offer.ok, true, "offer should be created");
assert.ok(offer.negotiation.agent?.id, "agent personality should be attached");
assert.ok(offer.negotiation.advanced?.hiddenIntention, "hidden intention should be attached");
assert.ok(Number.isFinite(offer.negotiation.advanced.pressure), "negotiation pressure should be numeric");
assert.ok(offer.negotiation.advanced.imageRights > 0, "image rights should be calculated");

const counter = FMG.resolveTransferNegotiation(FMG.gameState, offer.negotiation.id);
assert.equal(counter.ok, false, "low offer should not close immediately");
assert.equal(offer.negotiation.status, "countered", "low offer should become a counter");
assert.ok(advanced.drama.some((item) => item.playerId === target.id), "negotiation drama should persist");
assert.ok(Object.values(advanced.agents).some((agent) => agent.clients.includes(target.id)), "agent relationship should persist");

offer.negotiation.status = "pending";
offer.negotiation.fee = targetListing.askingPrice * 2;
offer.negotiation.wage = FMG.estimatePlayerWageDemand(target, "starter") * 2;
offer.negotiation.signingBonus = 0;
offer.negotiation.role = "starter";
FMG.gameState.finances.balance = 999999999;
FMG.gameState.finances.budgets.transfers = 999999999;
const accepted = FMG.resolveTransferNegotiation(FMG.gameState, offer.negotiation.id);
assert.equal(accepted.ok, true, "improved offer should close");
assert.equal(target.teamId, FMG.gameState.userTeamId, "accepted transfer should move player");
assert.ok(advanced.contracts.promises.some((promise) => promise.playerId === target.id), "contract promises should be stored");
assert.ok(advanced.contracts.wageHierarchy.some((entry) => entry.playerId === target.id), "wage hierarchy should include new signing");

FMG.runManagerEcosystemWeek(FMG.gameState, { phase: "transfer-test" });
assert.ok(Number.isFinite(advanced.economy.inflation), "weekly market layer should update inflation");
assert.ok(Number.isFinite(advanced.economy.financialPressure), "weekly market layer should update financial pressure");

const ownPlayer = FMG.gameState.players.find((player) => player.teamId === FMG.gameState.userTeamId && !player.retired);
FMG.generateIncomingOffers(FMG.gameState);
const incoming = FMG.gameState.market.incomingOffers.find((item) => item.playerId === ownPlayer.id) || FMG.gameState.market.incomingOffers[0];
if (incoming) {
  assert.ok(incoming.advanced, "incoming offers should include human pressure context");
}

const legacy = FMG.deepClone(FMG.gameState);
delete legacy.market.advanced;
const migrated = FMG.migrateSaveState(legacy);
FMG.ensureAdvancedTransferMarket(migrated);
assert.ok(migrated.market.advanced, "save migration should hydrate advanced market state");
assert.ok(migrated.market.advanced.clubs[migrated.userTeamId], "migrated market should retain club negotiation identity");

console.log("Advanced transfer market tests passed");
