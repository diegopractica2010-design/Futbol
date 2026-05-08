(function () {
  "use strict";

  const FMG = (window.FMG = window.FMG || {});

  const COMPONENT = Object.freeze({
    Position: "Position",
    Velocity: "Velocity",
    Team: "Team",
    Stamina: "Stamina",
    Input: "Input",
    AIState: "AIState",
    AnimationState: "AnimationState",
    PhysicsState: "PhysicsState",
    TacticalRole: "TacticalRole",
    Morale: "Morale",
    Fatigue: "Fatigue"
  });

  function ECSWorld() {
    this._nextEntity = 1;
    this.entities = [];
    this.components = {};
    this.systems = [];
  }

  ECSWorld.prototype.createEntity = function () {
    const id = this._nextEntity++;
    this.entities.push(id);
    return id;
  };

  ECSWorld.prototype.destroyEntity = function (entity) {
    const index = this.entities.indexOf(entity);
    if (index >= 0) this.entities.splice(index, 1);
    Object.keys(this.components).forEach((name) => {
      delete this.components[name][entity];
    });
  };

  ECSWorld.prototype.add = function (entity, componentName, data) {
    const store = this.components[componentName] || (this.components[componentName] = {});
    store[entity] = data || {};
    return store[entity];
  };

  ECSWorld.prototype.get = function (entity, componentName) {
    const store = this.components[componentName];
    return store ? store[entity] : null;
  };

  ECSWorld.prototype.remove = function (entity, componentName) {
    const store = this.components[componentName];
    if (store) delete store[entity];
  };

  ECSWorld.prototype.query = function (componentNames, out) {
    const result = out || [];
    result.length = 0;
    for (let index = 0; index < this.entities.length; index += 1) {
      const entity = this.entities[index];
      let ok = true;
      for (let c = 0; c < componentNames.length; c += 1) {
        const store = this.components[componentNames[c]];
        if (!store || !store[entity]) {
          ok = false;
          break;
        }
      }
      if (ok) result.push(entity);
    }
    return result;
  };

  ECSWorld.prototype.addSystem = function (system) {
    if (system && typeof system.update === "function") this.systems.push(system);
    return system;
  };

  ECSWorld.prototype.update = function (dt, context) {
    for (let index = 0; index < this.systems.length; index += 1) {
      this.systems[index].update(this, dt, context || {});
    }
  };

  function makeSystem(name, components, fn) {
    return {
      name,
      components,
      _query: [],
      update(world, dt, context) {
        const entities = world.query(components, this._query);
        fn(world, entities, dt, context || {});
      }
    };
  }

  const Systems = {
    MovementSystem: function () {
      return makeSystem("MovementSystem", [COMPONENT.Position, COMPONENT.Velocity], (world, entities, dt) => {
        for (let i = 0; i < entities.length; i += 1) {
          const entity = entities[i];
          const pos = world.get(entity, COMPONENT.Position);
          const vel = world.get(entity, COMPONENT.Velocity);
          pos.x += vel.x * dt;
          pos.y += vel.y * dt;
        }
      });
    },
    AISystem: function () {
      return makeSystem("AISystem", [COMPONENT.AIState, COMPONENT.Position], (world, entities, dt, context) => {
        for (let i = 0; i < entities.length; i += 1) {
          const ai = world.get(entities[i], COMPONENT.AIState);
          ai.timer = Math.max(0, (ai.timer || 0) - dt);
          if (ai.timer === 0) {
            ai.intent = context.defaultIntent || ai.intent || "hold";
            ai.timer = ai.throttle || 0.1;
          }
        }
      });
    },
    PassingSystem: function () {
      return makeSystem("PassingSystem", [COMPONENT.Position, COMPONENT.Team], () => {});
    },
    ShootingSystem: function () {
      return makeSystem("ShootingSystem", [COMPONENT.Position, COMPONENT.Team], () => {});
    },
    PhysicsSystem: function () {
      return makeSystem("PhysicsSystem", [COMPONENT.Position, COMPONENT.PhysicsState], (world, entities, dt) => {
        for (let i = 0; i < entities.length; i += 1) {
          const physics = world.get(entities[i], COMPONENT.PhysicsState);
          physics.sleepTimer = Math.max(0, (physics.sleepTimer || 0) - dt);
        }
      });
    },
    TacticalSystem: function () {
      return makeSystem("TacticalSystem", [COMPONENT.TacticalRole, COMPONENT.AIState], (world, entities) => {
        for (let i = 0; i < entities.length; i += 1) {
          const role = world.get(entities[i], COMPONENT.TacticalRole);
          const ai = world.get(entities[i], COMPONENT.AIState);
          ai.risk = role.risk || 1;
        }
      });
    },
    AnimationSystem: function () {
      return makeSystem("AnimationSystem", [COMPONENT.AnimationState], (world, entities, dt) => {
        for (let i = 0; i < entities.length; i += 1) {
          const anim = world.get(entities[i], COMPONENT.AnimationState);
          anim.time = (anim.time || 0) + dt;
        }
      });
    },
    CrowdSystem: function () {
      return makeSystem("CrowdSystem", [], (world, entities, dt, context) => {
        if (context.crowd) context.crowd.momentum = Math.max(0, Math.min(1, context.crowd.momentum || 0));
      });
    },
    AudioSystem: function () {
      return makeSystem("AudioSystem", [], () => {});
    },
    ReplaySystem: function () {
      return makeSystem("ReplaySystem", [], () => {});
    }
  };

  FMG.ECS = {
    COMPONENT,
    ECSWorld,
    Systems,
    createWorld() { return new ECSWorld(); },
    createFootballEntity(world, data) {
      const entity = world.createEntity();
      world.add(entity, COMPONENT.Position, { x: data.x || 0, y: data.y || 0 });
      world.add(entity, COMPONENT.Velocity, { x: data.vx || 0, y: data.vy || 0 });
      world.add(entity, COMPONENT.Team, { id: data.team || 0 });
      world.add(entity, COMPONENT.Stamina, { value: data.stamina || 1 });
      world.add(entity, COMPONENT.Fatigue, { value: data.fatigue || 0 });
      world.add(entity, COMPONENT.Morale, { value: data.morale || 70 });
      world.add(entity, COMPONENT.AIState, { intent: "hold", timer: 0, throttle: 0.1 });
      world.add(entity, COMPONENT.AnimationState, { name: "idle", time: 0 });
      world.add(entity, COMPONENT.PhysicsState, { mass: data.mass || 1, sleepTimer: 0 });
      world.add(entity, COMPONENT.TacticalRole, { name: data.role || "balanced", risk: 1 });
      return entity;
    }
  };
})();
