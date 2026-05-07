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
  "src/career.js",
  "src/news.js",
  "src/presentation.js",
  "src/saveSystem.js",
  "src/gameEngine.js"
].forEach((file) => {
  vm.runInThisContext(fs.readFileSync(path.join(root, file), "utf8"), { filename: file });
});

const FMG = window.FMG;
const teams = JSON.parse(fs.readFileSync(path.join(root, "data/teams.json"), "utf8"));
const players = JSON.parse(fs.readFileSync(path.join(root, "data/players.json"), "utf8"));

FMG.initializeGame(teams, players);
FMG.selectClub("colo-colo");

assert.ok(FMG.gameState.version >= 9, "fase 9 debe usar estado versionado desde 9");
assert.ok(FMG.gameState.finances.budgets, "debe tener presupuestos separados");
assert.ok(FMG.gameState.finances.sponsorDeal, "debe tener contrato de sponsor");
assert.ok(FMG.gameState.finances.tvDeal, "debe tener derechos TV");
assert.ok(FMG.gameState.finances.infrastructure, "debe tener infraestructura");
assert.ok(FMG.gameState.finances.staff, "debe tener staff");
assert.ok(Number.isFinite(FMG.gameState.finances.boardTrust), "debe tener confianza del directorio");

const balanceBeforeLoan = FMG.gameState.finances.balance;
const loan = FMG.takeBankLoan(FMG.gameState, 30000000);
assert.equal(loan.ok, true, "debe permitir prestamo bancario");
assert.ok(FMG.gameState.finances.balance > balanceBeforeLoan, "prestamo debe aumentar caja");
assert.ok(FMG.gameState.finances.debt > 0, "prestamo debe aumentar deuda");
assert.ok(FMG.gameState.finances.loans.length > 0, "prestamo debe quedar registrado");

const sponsorBefore = FMG.gameState.finances.sponsorDeal.weeklyAmount;
assert.equal(FMG.negotiateSponsor(FMG.gameState).ok, true, "debe negociar sponsor");
assert.ok(FMG.gameState.finances.sponsorDeal.weeklyAmount > 0, "sponsor debe tener pago semanal");
assert.ok(FMG.gameState.finances.sponsorDeal.weeklyAmount !== sponsorBefore || FMG.gameState.finances.boardTrust > 0, "negociacion debe actualizar estado comercial");

FMG.gameState.finances.balance = 200000000;
FMG.gameState.finances.budgets.infrastructure = 100000000;
FMG.gameState.finances.budgets.operations = 100000000;
const stadiumBefore = FMG.gameState.finances.infrastructure.stadium;
assert.equal(FMG.upgradeInfrastructure(FMG.gameState, "stadium").ok, true, "debe mejorar estadio");
assert.equal(FMG.gameState.finances.infrastructure.stadium, stadiumBefore + 1, "estadio debe subir nivel");
const staffBefore = FMG.gameState.finances.staff.medical;
assert.equal(FMG.upgradeStaff(FMG.gameState, "medical").ok, true, "debe mejorar staff medico");
assert.equal(FMG.gameState.finances.staff.medical, staffBefore + 1, "staff medico debe subir nivel");

const report = FMG.processWeeklyFinances(FMG.gameState);
assert.ok(Number.isFinite(report.net), "reporte semanal debe calcular neto");
assert.ok(Number.isFinite(report.tvIncome), "reporte debe incluir TV");
assert.ok(Number.isFinite(report.debtPayment), "reporte debe incluir deuda");
assert.ok(FMG.gameState.finances.weeklyReport.length > 0, "finanzas semanales deben registrarse");
assert.ok(FMG.gameState.finances.debt < loan.loan.principal || FMG.gameState.finances.loans[0].weeksRemaining < 24, "deuda debe amortizarse semanalmente");

FMG.gameState.finances.financialFairPlay.wageLimit = 1;
const ffp = FMG.evaluateFinancialFairPlay(FMG.gameState);
assert.notEqual(ffp.status, "ok", "fair play debe advertir exceso salarial");
const trustBefore = FMG.gameState.finances.boardTrust;
FMG.updateBoardTrust(FMG.gameState, "Test crisis", -100);
assert.ok(FMG.gameState.finances.boardTrust < trustBefore, "confianza debe poder bajar");
assert.ok(FMG.gameState.finances.crisis, "confianza baja debe activar crisis");

const prospect = FMG.gameState.players.find((player) => player.teamId === FMG.gameState.userTeamId && player.age <= 24);
prospect.overall = 50;
prospect.potential = 80;
FMG.gameState.finances.infrastructure.training = 5;
FMG.gameState.finances.staff.coaching = 5;
let progressed = false;
for (let index = 0; index < 30 && !progressed; index += 1) {
  const before = prospect.overall;
  FMG.applyInfrastructureEffects(FMG.gameState);
  progressed = prospect.overall > before;
}
assert.equal(progressed, true, "infraestructura y staff deben poder mejorar desarrollo");

const save = FMG.saveGame();
assert.equal(save.ok, true, "debe guardar finanzas avanzadas");
const parsed = JSON.parse(localStorage.data[FMG.STORAGE_KEY]);
parsed.version = 8;
delete parsed.finances.budgets;
delete parsed.finances.infrastructure;
delete parsed.finances.staff;
delete parsed.finances.sponsorDeal;
localStorage.data[FMG.STORAGE_KEY] = JSON.stringify(parsed);
assert.equal(FMG.loadGame().ok, true, "debe migrar save anterior sin finanzas avanzadas");
assert.ok(FMG.gameState.version >= 9, "save debe migrar a version 9 o superior");
assert.ok(FMG.gameState.finances.budgets, "save migrado debe crear presupuestos");
assert.ok(FMG.gameState.finances.infrastructure, "save migrado debe crear infraestructura");

console.log("Phase 9 tests passed");
