(function () {
  "use strict";

  window.FMG = window.FMG || {};
  window.FMG.Phase23 = window.FMG.Phase23 || {};

  var C = null;

  window.FMG.Phase23.createGame = function (canvas) {
    C = window.FMG.Phase16.C;

    var game = window.FMG.Phase22.createGame(canvas);
    var stadiumAudio = new window.FMG.Phase23.StadiumAudio();
    var lastScore = game.match.score.slice();
    var lastBallSpeed = 0;
    var lastBallX = game.ball.ball.x;

    game.stadiumAudio = stadiumAudio;
    game.audio = stadiumAudio;

    var origStart = game.start.bind(game);
    game.start = function () {
      stadiumAudio.startMatch();
      origStart();
    };

    var origLogic = game._logicTick.bind(game);
    game._logicTick = function () {
      var beforeScore = game.match.score.slice();
      var beforeSpeed = Math.hypot(game.ball.ball.vx, game.ball.ball.vy);
      var beforeX = game.ball.ball.x;

      origLogic();

      var afterSpeed = Math.hypot(game.ball.ball.vx, game.ball.ball.vy);
      var b = game.ball.ball;
      stadiumAudio.tick(game.match, game.ball);

      if (game.match.score[0] !== beforeScore[0] || game.match.score[1] !== beforeScore[1]) {
        stadiumAudio.playGoal();
        lastScore = game.match.score.slice();
      } else if (crossedGoalLineWithoutGoal(beforeX, b.x, b.y, afterSpeed)) {
        stadiumAudio.playNearMiss();
      } else if (afterSpeed > beforeSpeed + 2.8) {
        stadiumAudio.playKick();
      }

      lastBallSpeed = afterSpeed;
      lastBallX = b.x;
    };

    var origReset = game.reset.bind(game);
    game.reset = function () {
      origReset();
      lastScore = game.match.score.slice();
      lastBallSpeed = 0;
      lastBallX = game.ball.ball.x;
      stadiumAudio.playWhistle();
    };

    var origDispose = game.dispose.bind(game);
    game.dispose = function () {
      stadiumAudio.stop();
      origDispose();
    };

    game.playFoulAudio = function () {
      stadiumAudio.playFoul();
    };

    return game;
  };

  function crossedGoalLineWithoutGoal(prevX, x, y, speed) {
    if (!C || speed < 3.5) return false;
    var goalTop = (C.FIELD_H - C.GOAL_H) / 2;
    var goalBot = goalTop + C.GOAL_H;
    var nearGoalY = y > goalTop - 46 && y < goalBot + 46;
    var outsideMouth = y < goalTop || y > goalBot;
    var crossedLeft = prevX > C.BALL_R && x <= C.BALL_R + 1;
    var crossedRight = prevX < C.FIELD_W - C.BALL_R && x >= C.FIELD_W - C.BALL_R - 1;
    return nearGoalY && outsideMouth && (crossedLeft || crossedRight);
  }
})();
