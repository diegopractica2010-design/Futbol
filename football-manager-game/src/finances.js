(function () {
  const FMG = (window.FMG = window.FMG || {});

  function defaultFinanceState(current = {}, club = {}) {
    const baseBudget = club.budget || 90000000;
    return {
      balance: current.balance || 0,
      incomeHistory: current.incomeHistory || [],
      expenseHistory: current.expenseHistory || [],
      weeklyReport: current.weeklyReport || [],
      budgets: {
        transfers: current.budgets?.transfers ?? Math.round(baseBudget * 0.42),
        wages: current.budgets?.wages ?? Math.round(baseBudget * 0.32),
        infrastructure: current.budgets?.infrastructure ?? Math.round(baseBudget * 0.16),
        operations: current.budgets?.operations ?? Math.round(baseBudget * 0.1)
      },
      debt: current.debt || 0,
      loans: current.loans || [],
      sponsorDeal: current.sponsorDeal || null,
      tvDeal: current.tvDeal || null,
      infrastructure: {
        stadium: current.infrastructure?.stadium || 1,
        training: current.infrastructure?.training || 1,
        medical: current.infrastructure?.medical || 1
      },
      staff: {
        coaching: current.staff?.coaching || 1,
        scouting: current.staff?.scouting || 1,
        medical: current.staff?.medical || 1
      },
      boardTrust: Number.isFinite(current.boardTrust) ? current.boardTrust : 65,
      financialFairPlay: current.financialFairPlay || { wageLimit: Math.round(baseBudget * 0.46), status: "ok", warnings: [] },
      crisis: current.crisis || null
    };
  }

  function totalWeeklyWages(state) {
    return state.players
      .filter((player) => player.teamId === state.userTeamId && !player.retired)
      .reduce((sum, player) => sum + player.salary, 0);
  }

  function addBudget(finances, key, amount) {
    finances.budgets[key] = Math.max(0, (finances.budgets[key] || 0) + amount);
  }

  FMG.ensureAdvancedFinances = function (state) {
    state.finances = defaultFinanceState(state.finances, state.userClub || {});
    if (!state.finances.sponsorDeal && state.userClub) {
      state.finances.sponsorDeal = {
        name: "Sponsor principal",
        weeklyAmount: Math.round(state.userClub.sponsor * 0.085),
        bonusPerWin: Math.round(state.userClub.sponsor * 0.018),
        weeksRemaining: state.totalWeeks || 14
      };
    }
    if (!state.finances.tvDeal && state.userClub) {
      state.finances.tvDeal = {
        name: "Derechos TV liga",
        weeklyAmount: Math.round((state.userClub.fanBase || 300000) * 18),
        performanceBonus: 8000000
      };
    }
    if (!Number.isFinite(state.finances.financialFairPlay.wageLimit) || state.finances.financialFairPlay.wageLimit <= 0) {
      state.finances.financialFairPlay.wageLimit = Math.round((state.userClub?.budget || 90000000) * 0.46);
    }
    return state.finances;
  };

  FMG.registerFinanceEntry = function (finances, type, label, amount, budgetKey) {
    const entry = { type, label, amount, budgetKey: budgetKey || null, date: new Date().toISOString() };

    if (amount > 0) finances.incomeHistory.unshift(entry);
    else if (amount < 0) finances.expenseHistory.unshift(entry);

    finances.weeklyReport.unshift(entry);
    finances.weeklyReport = finances.weeklyReport.slice(0, 10);
    finances.balance = FMG.clamp(finances.balance + amount, -999999999, 9999999999);
    if (budgetKey && amount < 0 && finances.budgets?.[budgetKey] !== undefined) {
      finances.budgets[budgetKey] = Math.max(0, finances.budgets[budgetKey] + amount);
    }
    return entry;
  };

  FMG.evaluateFinancialFairPlay = function (state) {
    const finances = FMG.ensureAdvancedFinances(state);
    const wageExpense = totalWeeklyWages(state);
    const warnings = [];
    if (wageExpense > finances.financialFairPlay.wageLimit) warnings.push("Masa salarial sobre limite");
    if (finances.debt > (state.userClub?.budget || 90000000) * 0.85) warnings.push("Deuda elevada");
    if (finances.balance < -25000000) warnings.push("Saldo negativo critico");
    finances.financialFairPlay.warnings = warnings;
    finances.financialFairPlay.status = warnings.length >= 2 ? "critical" : warnings.length ? "warning" : "ok";
    return finances.financialFairPlay;
  };

  FMG.updateBoardTrust = function (state, reason, amount) {
    const finances = FMG.ensureAdvancedFinances(state);
    finances.boardTrust = FMG.clamp(finances.boardTrust + amount, 0, 100);
    if (finances.boardTrust < 25) {
      finances.crisis = { type: "board", reason: reason || "Confianza baja", week: state.currentWeek };
    }
    return finances.boardTrust;
  };

  FMG.takeBankLoan = function (state, amount) {
    const finances = FMG.ensureAdvancedFinances(state);
    const value = FMG.clamp(Number(amount) || 0, 5000000, 120000000);
    const loan = {
      id: FMG.uid("loan"),
      principal: value,
      remaining: value,
      weeklyPayment: Math.round(value / 24),
      interestRate: 0.14,
      weeksRemaining: 24
    };
    finances.loans.unshift(loan);
    finances.debt += value;
    addBudget(finances, "transfers", Math.round(value * 0.55));
    addBudget(finances, "infrastructure", Math.round(value * 0.25));
    FMG.registerFinanceEntry(finances, "income", "Prestamo bancario", value);
    FMG.updateBoardTrust(state, "Prestamo bancario", -4);
    return { ok: true, message: `Prestamo aprobado por ${FMG.currency(value)}.`, loan };
  };

  FMG.previewFinancialAction = function (state, actionType, params = {}) {
    const finances = FMG.ensureAdvancedFinances(state);
    if (actionType === "loan") {
      const value = FMG.clamp(Number(params.amount) || 30000000, 5000000, 120000000);
      const fee = Math.round(value * 0.05);
      return {
        title: `Prestamo de ${FMG.currency(value)}`,
        currentBalance: finances.balance,
        income: value,
        fee,
        finalBalance: finances.balance + value - fee,
        weeklyPayment: Math.round(value / 40),
        weeksRemaining: 40
      };
    }
    return {
      title: "Accion financiera",
      currentBalance: finances.balance,
      income: 0,
      fee: 0,
      finalBalance: finances.balance,
      weeklyPayment: 0,
      weeksRemaining: 0
    };
  };

  FMG.negotiateSponsor = function (state) {
    const finances = FMG.ensureAdvancedFinances(state);
    const position = state.standings.findIndex((entry) => entry.teamId === state.userTeamId) + 1 || state.teams.length;
    const multiplier = position <= 2 ? 1.25 : position <= 4 ? 1.08 : 0.92;
    const weeklyAmount = Math.round((state.userClub.sponsor || 40000000) * 0.085 * multiplier);
    finances.sponsorDeal = {
      name: position <= 2 ? "Sponsor premium" : "Sponsor principal",
      weeklyAmount,
      bonusPerWin: Math.round(weeklyAmount * 0.22),
      weeksRemaining: state.totalWeeks || 14
    };
    FMG.updateBoardTrust(state, "Nuevo sponsor", 3);
    return { ok: true, message: `Nuevo sponsor semanal: ${FMG.currency(weeklyAmount)}.` };
  };

  FMG.upgradeInfrastructure = function (state, area) {
    const finances = FMG.ensureAdvancedFinances(state);
    if (!["stadium", "training", "medical"].includes(area)) return { ok: false, message: "Infraestructura no disponible." };
    const current = finances.infrastructure[area] || 1;
    if (current >= 5) return { ok: false, message: "Esa infraestructura ya esta al maximo." };
    const cost = Math.round(9000000 * current * (area === "stadium" ? 1.35 : 1));
    if (finances.budgets.infrastructure < cost || finances.balance < cost) return { ok: false, message: "No hay presupuesto de infraestructura suficiente." };
    finances.infrastructure[area] += 1;
    FMG.registerFinanceEntry(finances, "expense", `Mejora ${area}`, -cost, "infrastructure");
    FMG.updateBoardTrust(state, "Mejora institucional", 2);
    return { ok: true, message: `${area} sube a nivel ${finances.infrastructure[area]}.` };
  };

  FMG.upgradeStaff = function (state, area) {
    const finances = FMG.ensureAdvancedFinances(state);
    if (!["coaching", "scouting", "medical"].includes(area)) return { ok: false, message: "Staff no disponible." };
    const current = finances.staff[area] || 1;
    if (current >= 5) return { ok: false, message: "Ese staff ya esta al maximo." };
    const cost = Math.round(5200000 * current);
    if (finances.budgets.operations < cost || finances.balance < cost) return { ok: false, message: "No hay presupuesto operativo suficiente." };
    finances.staff[area] += 1;
    FMG.registerFinanceEntry(finances, "expense", `Mejora staff ${area}`, -cost, "operations");
    return { ok: true, message: `Staff ${area} sube a nivel ${finances.staff[area]}.` };
  };

  FMG.processWeeklyFinances = function (state) {
    const finances = FMG.ensureAdvancedFinances(state);
    const club = state.userClub;
    const stadiumBoost = 1 + (finances.infrastructure.stadium - 1) * 0.12;
    const estimatedAttendance = FMG.clamp(Math.round((club.fanBase * 0.006 + FMG.rng() * 3500) * stadiumBoost), 2500, 52000);
    const ticketPrice = 6500 + (finances.infrastructure.stadium - 1) * 450;
    const attendanceIncome = Math.round(estimatedAttendance * ticketPrice);
    const sponsorshipIncome = Math.round(finances.sponsorDeal.weeklyAmount);
    const tvIncome = Math.round(finances.tvDeal.weeklyAmount);
    const wageExpense = -Math.round(totalWeeklyWages(state));
    const pressure = state.settings?.seasonOptions?.financialPressure || "normal";
    const pressureFactor = pressure === "relaxed" ? 0.86 : pressure === "strict" ? 1.18 : 1;
    const operationsExpense = -Math.round((club.infrastructureCost * 0.22 + (finances.staff.coaching + finances.staff.scouting + finances.staff.medical) * 850000) * pressureFactor);
    const debtPayment = -finances.loans.reduce((sum, loan) => sum + (loan.weeksRemaining > 0 ? loan.weeklyPayment : 0), 0);

    FMG.registerFinanceEntry(finances, "income", "Taquilla y abonados", attendanceIncome);
    FMG.registerFinanceEntry(finances, "income", "Pago de patrocinio", sponsorshipIncome);
    FMG.registerFinanceEntry(finances, "income", "Derechos de TV", tvIncome);
    FMG.registerFinanceEntry(finances, "expense", "Sueldos de plantilla", wageExpense, "wages");
    FMG.registerFinanceEntry(finances, "expense", "Operacion del club y staff", operationsExpense, "operations");
    if (debtPayment < 0) {
      FMG.registerFinanceEntry(finances, "expense", "Servicio de deuda", debtPayment, "operations");
      finances.loans.forEach((loan) => {
        if (loan.weeksRemaining > 0) {
          loan.weeksRemaining -= 1;
          loan.remaining = Math.max(0, loan.remaining - loan.weeklyPayment);
        }
      });
      finances.debt = finances.loans.reduce((sum, loan) => sum + loan.remaining, 0);
    }

    const ffp = FMG.evaluateFinancialFairPlay(state);
    if (ffp.status === "critical") FMG.updateBoardTrust(state, "Fair play financiero critico", -7);
    else if (ffp.status === "warning") FMG.updateBoardTrust(state, "Advertencia financiera", -3);
    else if (finances.balance > 0) FMG.updateBoardTrust(state, "Semana financiera estable", 1);

    if (finances.balance < -35000000) {
      finances.crisis = { type: "cash", reason: "Caja negativa", week: state.currentWeek };
    }

    return {
      attendanceIncome,
      sponsorshipIncome,
      tvIncome,
      wageExpense,
      operationsExpense,
      debtPayment,
      net: attendanceIncome + sponsorshipIncome + tvIncome + wageExpense + operationsExpense + debtPayment,
      fairPlayStatus: ffp.status,
      boardTrust: finances.boardTrust
    };
  };

  FMG.applyInfrastructureEffects = function (state) {
    const finances = FMG.ensureAdvancedFinances(state);
    const trainingBonus = Math.max(0, finances.infrastructure.training - 1) * 0.015 + Math.max(0, finances.staff.coaching - 1) * 0.01;
    const medicalReduction = Math.max(0, finances.infrastructure.medical - 1) + Math.max(0, finances.staff.medical - 1);
    let improvedPlayers = 0;
    state.players.filter((player) => player.teamId === state.userTeamId && !player.retired).forEach((player) => {
      if (player.overall < player.potential && FMG.rng() < trainingBonus) {
        player.overall += 1;
        improvedPlayers += 1;
      }
      if ((player.injuredWeeks || 0) > 0 && medicalReduction > 0 && FMG.rng() < medicalReduction * 0.08) {
        player.injuredWeeks = Math.max(0, player.injuredWeeks - 1);
      }
    });
    if (improvedPlayers && FMG.recordCareerDevelopment) FMG.recordCareerDevelopment(state, improvedPlayers, "Infraestructura y staff de desarrollo");
  };

  FMG.financeHeadline = function (report) {
    const base = report.net >= 0
      ? `La semana cerro en verde: ${FMG.currency(report.net)}.`
      : `La semana cerro en rojo: ${FMG.currency(report.net)}.`;
    return `${base} Fair play: ${report.fairPlayStatus}. Directorio: ${report.boardTrust}/100.`;
  };
})();
