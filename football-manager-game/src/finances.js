(function () {
  const FMG = (window.FMG = window.FMG || {});

  FMG.registerFinanceEntry = function (finances, type, label, amount) {
    const entry = { type, label, amount, date: new Date().toISOString() };

    if (amount >= 0) finances.incomeHistory.unshift(entry);
    else finances.expenseHistory.unshift(entry);

    finances.weeklyReport.unshift(entry);
    finances.weeklyReport = finances.weeklyReport.slice(0, 8);
    finances.balance = FMG.clamp(finances.balance + amount, -999999999, 9999999999);
    return entry;
  };

  FMG.processWeeklyFinances = function (state) {
    const club = state.userClub;
    const attendanceIncome = Math.round(club.fanBase * 18000 + Math.random() * 3500000);
    const sponsorshipIncome = Math.round(club.sponsor * 0.085);
    const wageExpense = -Math.round(
      state.players.filter((player) => player.teamId === club.id).reduce((sum, player) => sum + player.salary, 0)
    );
    const operationsExpense = -Math.round(club.infrastructureCost * 0.25);

    FMG.registerFinanceEntry(state.finances, "income", "Taquilla y abonados", attendanceIncome);
    FMG.registerFinanceEntry(state.finances, "income", "Pago de patrocinio", sponsorshipIncome);
    FMG.registerFinanceEntry(state.finances, "expense", "Sueldos de plantilla", wageExpense);
    FMG.registerFinanceEntry(state.finances, "expense", "Operacion del club", operationsExpense);

    return {
      attendanceIncome,
      sponsorshipIncome,
      wageExpense,
      operationsExpense,
      net: attendanceIncome + sponsorshipIncome + wageExpense + operationsExpense
    };
  };

  FMG.financeHeadline = function (report) {
    return report.net >= 0
      ? `La semana cerro en verde: ${FMG.currency(report.net)}.`
      : `La semana cerro en rojo: ${FMG.currency(report.net)}.`;
  };
})();
