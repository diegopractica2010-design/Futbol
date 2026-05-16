(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});

  const CATEGORY_MAP = {
    error: { label: "Alerta", icon: "!", timeout: 7200 },
    warning: { label: "Atencion", icon: "!", timeout: 6400 },
    success: { label: "Confirmado", icon: "+", timeout: 4600 },
    achievement: { label: "Hito", icon: "*", timeout: 7200 },
    match: { label: "Partido", icon: "90", timeout: 5600 },
    market: { label: "Mercado", icon: "$", timeout: 5600 },
    info: { label: "Club", icon: "i", timeout: 5200 }
  };

  function inferType(message, type) {
    if (type && CATEGORY_MAP[type]) return type;
    const text = String(message || "").toLowerCase();
    if (text.includes("gol") || text.includes("partido") || text.includes("minuto")) return "match";
    if (text.includes("oferta") || text.includes("mercado") || text.includes("fich")) return "market";
    if (text.includes("error") || text.includes("danada") || text.includes("no se")) return "warning";
    if (text.includes("guard") || text.includes("confirm") || text.includes("inici")) return "success";
    return "info";
  }

  const NotificationManager = {
    ensure(state) {
      state.notifications = Array.isArray(state.notifications) ? state.notifications : [];
      state.notificationLog = Array.isArray(state.notificationLog) ? state.notificationLog : [];
      return state.notifications;
    },

    push(state, message, type = "info", options = {}) {
      this.ensure(state);
      const resolvedType = inferType(message, type);
      const meta = CATEGORY_MAP[resolvedType] || CATEGORY_MAP.info;
      const now = Date.now();
      const notification = {
        id: `${now}-${Math.random().toString(16).slice(2)}`,
        message,
        type: resolvedType,
        label: meta.label,
        icon: meta.icon,
        createdAt: new Date(now).toISOString(),
        expiresAt: options.sticky ? null : now + (options.timeout || meta.timeout)
      };
      state.notifications = [notification, ...state.notifications].slice(0, 5);
      state.notificationLog.unshift(notification);
      state.notificationLog = state.notificationLog.slice(0, 60);
      return notification;
    },

    dismiss(state, id) {
      this.ensure(state);
      state.notifications = state.notifications.filter((item) => item.id !== id);
    },

    prune(state, now = Date.now()) {
      this.ensure(state);
      const before = state.notifications.length;
      state.notifications = state.notifications.filter((item) => !item.expiresAt || item.expiresAt > now);
      return before !== state.notifications.length;
    },

    render(state, escapeHtml) {
      this.ensure(state);
      return `
        <div class="toast-stack" role="status" aria-live="polite">
          ${state.notifications.map((notification, index) => `
            <article class="toast toast-${escapeHtml(notification.type || "info")}" data-id="${escapeHtml(notification.id)}" style="--toast-index:${index};">
              <span class="toast-icon">${escapeHtml(notification.icon || "i")}</span>
              <div class="toast-copy">
                <strong>${escapeHtml(notification.label || "Club")}</strong>
                <p>${escapeHtml(notification.message || "")}</p>
              </div>
              <button class="toast-close" data-action="dismiss-toast" data-id="${escapeHtml(notification.id)}" aria-label="Cerrar aviso">x</button>
            </article>
          `).join("")}
        </div>
      `;
    }
  };

  const UITheme = {
    apply(state) {
      const clubId = state?.userTeamId;
      const identity = clubId && FMG.getClubIdentity ? FMG.getClubIdentity(clubId) : null;
      const root = document.documentElement;
      if (!identity || !root) return;
      root.style.setProperty("--club-primary", identity.primary);
      root.style.setProperty("--club-secondary", identity.secondary);
      root.style.setProperty("--club-accent", identity.accent);
    }
  };

  const UIAnimationController = {
    pulse(selector, className = "ui-pulse") {
      const element = document.querySelector(selector);
      if (!element) return;
      element.classList.remove(className);
      window.requestAnimationFrame(() => element.classList.add(className));
    }
  };

  FMG.NotificationManager = NotificationManager;
  FMG.UITheme = UITheme;
  FMG.UIAnimationController = UIAnimationController;
})();
