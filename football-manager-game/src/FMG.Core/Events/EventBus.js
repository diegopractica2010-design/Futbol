(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});
  FMG.Core = FMG.Core || {};
  FMG.Core.Events = FMG.Core.Events || {};

  /**
   * Immutable domain event base class
   */
  function DomainEvent(type, payload) {
    this.type = type;
    this.payload = payload || {};
    this.timestamp = this.payload.timestamp || FMG.Core.Utils.Determinism.nextTimestamp();
    this.id = this.payload.id || FMG.Core.Utils.Determinism.id("event", [type, this.timestamp, this.payload]);
  }

  DomainEvent.prototype.freeze = function () {
    Object.freeze(this.payload);
    Object.freeze(this);
    return this;
  };

  /**
   * Typed, deterministic EventBus
   * - Synchronous only (no async)
   * - All events immutable
   * - History preserved for replay
   */
  function EventBus() {
    this._handlers = {};
    this._history = [];
    this._maxHistory = 1000;
    this._dispatching = false;
    this._queue = [];
  }

  EventBus.prototype.on = function (eventType, handler) {
    if (!eventType || typeof handler !== "function") {
      return function () {};
    }
    const list = this._handlers[eventType] || (this._handlers[eventType] = []);
    list.push(handler);
    return () => this.off(eventType, handler);
  };

  EventBus.prototype.once = function (eventType, handler) {
    const off = this.on(eventType, (event) => {
      off();
      handler(event);
    });
    return off;
  };

  EventBus.prototype.off = function (eventType, handler) {
    const list = this._handlers[eventType];
    if (!list) return false;
    const index = list.indexOf(handler);
    if (index < 0) return false;
    list.splice(index, 1);
    return true;
  };

  EventBus.prototype.emit = function (eventType, payload) {
    const event = new DomainEvent(eventType, payload).freeze();
    this._queue.push(event);
    if (!this._dispatching) {
      this._flush();
    }
    return event;
  };

  EventBus.prototype._flush = function () {
    this._dispatching = true;
    try {
      while (this._queue.length > 0) {
        const event = this._queue.shift();
        this._history.unshift(event);
        this._history.length = Math.min(this._history.length, this._maxHistory);

        const handlers = this._handlers[event.type] || [];
        for (let i = 0; i < handlers.length; i++) {
          try {
            handlers[i](event);
          } catch (err) {
            console.error(`Error in handler for ${event.type}:`, err);
          }
        }

        const allHandlers = this._handlers["*"] || [];
        for (let i = 0; i < allHandlers.length; i++) {
          try {
            allHandlers[i](event);
          } catch (err) {
            console.error(`Error in wildcard handler:`, err);
          }
        }
      }
    } finally {
      this._dispatching = false;
    }
  };

  EventBus.prototype.history = function (eventType) {
    if (!eventType) {
      return this._history.slice();
    }
    return this._history.filter((event) => event.type === eventType);
  };

  EventBus.prototype.clear = function () {
    this._history = [];
    this._queue = [];
  };

  EventBus.prototype.snapshot = function () {
    return {
      eventCount: this._history.length,
      events: this._history.slice(),
      timestamp: FMG.Core.Utils.Determinism.nextTimestamp()
    };
  };

  FMG.Core.Events.DomainEvent = DomainEvent;
  FMG.Core.Events.EventBus = EventBus;

  /**
   * Predefined event types (domain contract)
   */
  FMG.Core.Events.EventTypes = Object.freeze({
    // Simulation events
    WEEK_ADVANCED: "WEEK_ADVANCED",
    MATCH_COMPLETED: "MATCH_COMPLETED",
    INJURY_OCCURRED: "INJURY_OCCURRED",
    CARD_ISSUED: "CARD_ISSUED",
    GOAL_SCORED: "GOAL_SCORED",

    // Transfer events
    OFFER_MADE: "OFFER_MADE",
    OFFER_ACCEPTED: "OFFER_ACCEPTED",
    OFFER_REJECTED: "OFFER_REJECTED",
    TRANSFER_COMPLETED: "TRANSFER_COMPLETED",

    // Career events
    REPUTATION_CHANGED: "REPUTATION_CHANGED",
    OBJECTIVE_COMPLETED: "OBJECTIVE_COMPLETED",
    OBJECTIVE_FAILED: "OBJECTIVE_FAILED",
    JOB_OFFER_RECEIVED: "JOB_OFFER_RECEIVED",

    // Finance events
    BALANCE_CHANGED: "BALANCE_CHANGED",
    FFP_STATUS_CHANGED: "FFP_STATUS_CHANGED",
    LOAN_PAYMENT_DUE: "LOAN_PAYMENT_DUE",

    // Club events
    LINEUP_CHANGED: "LINEUP_CHANGED",
    TACTICS_CHANGED: "TACTICS_CHANGED",
    FINANCIAL_CRISIS: "FINANCIAL_CRISIS"
  });
})();
