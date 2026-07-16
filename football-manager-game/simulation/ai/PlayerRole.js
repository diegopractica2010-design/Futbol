(function () {
  "use strict";

  // ============================================================
  // FASE 18 — PlayerRole.js
  // Rol por indice de jugador y sus parametros de comportamiento.
  // Inmutable. No tiene estado.
  // ============================================================

  window.FMG.Phase18 = window.FMG.Phase18 || {};

  // Roles por indice de jugador (0-10): 1-4 defensa, 5-7 medio, 8-10 ataque.
  var ROLES = [
    {
      name:          "goalkeeper",
      pressRadius:   40,    // distancia a la que sale a presionar
      markRadius:    60,    // distancia a la que marca un rival
      supportRadius: 80,    // distancia a la que apoya al poseedor
      aggression:    0.3,   // 0=pasivo, 1=muy agresivo
      stayBack:      true,  // nunca sube al ataque
      shootDist:     999    // no tira (portero)
    },
    {
      name:          "defender-left",
      pressRadius:   90,
      markRadius:    80,
      supportRadius: 100,
      aggression:    0.5,
      stayBack:      true,
      shootDist:     200
    },
    {
      name:          "defender-right",
      pressRadius:   90,
      markRadius:    80,
      supportRadius: 100,
      aggression:    0.5,
      stayBack:      true,
      shootDist:     200
    },
    {
      name:          "defender-center",
      pressRadius:   88,
      markRadius:    92,
      supportRadius: 95,
      aggression:    0.48,
      stayBack:      true,
      shootDist:     190
    },
    {
      name:          "defender-wide",
      pressRadius:   95,
      markRadius:    85,
      supportRadius: 105,
      aggression:    0.55,
      stayBack:      true,
      shootDist:     210
    },
    {
      name:          "midfielder-left",
      pressRadius:   130,
      markRadius:    100,
      supportRadius: 120,
      aggression:    0.7,
      stayBack:      false,
      shootDist:     180
    },
    {
      name:          "midfielder",
      pressRadius:   130,
      markRadius:    100,
      supportRadius: 120,
      aggression:    0.7,
      stayBack:      false,
      shootDist:     180
    },
    {
      name:          "midfielder-right",
      pressRadius:   130,
      markRadius:    100,
      supportRadius: 120,
      aggression:    0.7,
      stayBack:      false,
      shootDist:     180
    },
    {
      name:          "winger-left",
      pressRadius:   160,
      markRadius:    110,
      supportRadius: 140,
      aggression:    0.9,
      stayBack:      false,
      shootDist:     140
    },
    {
      name:          "forward",
      pressRadius:   165,
      markRadius:    110,
      supportRadius: 145,
      aggression:    0.92,
      stayBack:      false,
      shootDist:     150
    },
    {
      name:          "winger-right",
      pressRadius:   160,
      markRadius:    110,
      supportRadius: 140,
      aggression:    0.9,
      stayBack:      false,
      shootDist:     140
    }
  ];

  function PlayerRole() {}

  PlayerRole.get = function (playerIndex) {
    return ROLES[playerIndex] || ROLES[ROLES.length - 1];
  };

  window.FMG.Phase18.PlayerRole = PlayerRole;
})();
