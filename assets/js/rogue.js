/*
 * Короткая Rogue. Считается в браузере.
 * Партия лежит в localStorage под ключом pau-rogue.
 * Учебные фразы правятся в lesson.js.
 */
(function (root) {
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randBetween(roll, lo, hi) {
    return lo + Math.floor(roll() * (hi - lo + 1));
  }

  function Game() {
    this.seed = 1;
    this.w = 46;
    this.h = 20;
    this.depth = 1;
    this.px = 1;
    this.py = 1;
    this.hp = 22;
    this.maxHp = 22;
    this.atkBase = 3;
    this.weaponBonus = 0;
    this.weaponName = "кулаки";
    this.defBonus = 0;
    this.armorName = "нет";
    this.gold = 0;
    this.hunger = 0;
    this.food = 0;
    this.potions = 0;
    this.hasAmulet = false;
    this.turns = 0;
    this.over = "";
    this.lesson = "";
    this.lastAction = "";
    this.log = [];
    this.map = [];
    this.monsters = [];
    this.items = [];
    this.seen = [];
    this.floors = {};
    this.visible = {};
    this.actions = [];
    this.actionNames = {};
    this.roll = Math.random;
  }

  Game.create = function (seed) {
    var attemptSeed = seed | 0;
    var lastError = null;
    var n;
    for (n = 0; n < 8; n++) {
      try {
        return Game.build(attemptSeed + n);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error("Не получилось собрать этаж Rogue.");
  };

  Game.build = function (seed) {
    var roll = mulberry32(seed);
    var game = new Game();
    game.seed = seed;
    game.roll = roll;
    game.log = ["Ты в подземелье. Амулет лежит на 4 этаже. Вынеси его наверх."];
    var start = [1, 1];
    var depth;
    for (depth = 1; depth <= 4; depth++) {
      var pack = makeFloor(depth, game.w, game.h, roll);
      if (depth === 1 && pack.start) {
        start = pack.start;
      }
      delete pack.start;
      game.floors[depth] = pack;
    }
    game.applyFloor(1);
    game.px = start[0];
    game.py = start[1];
    game.roll = Math.random;
    game.reveal();
    return game;
  };

  Game.fromState = function (data) {
    var game = new Game();
    var keys = [
      "seed", "w", "h", "depth", "px", "py", "hp", "maxHp", "atkBase",
      "weaponBonus", "weaponName", "defBonus", "armorName", "gold",
      "hunger", "food", "potions", "hasAmulet", "turns", "over",
      "lesson", "lastAction", "log", "map", "monsters", "items",
      "seen", "floors"
    ];
    var i;
    for (i = 0; i < keys.length; i++) {
      if (data[keys[i]] !== undefined) {
        game[keys[i]] = data[keys[i]];
      }
    }
    game.roll = Math.random;
    game.reveal();
    return game;
  };

  Game.prototype.toState = function () {
    this.saveFloor();
    return {
      seed: this.seed, w: this.w, h: this.h, depth: this.depth,
      px: this.px, py: this.py, hp: this.hp, maxHp: this.maxHp,
      atkBase: this.atkBase, weaponBonus: this.weaponBonus,
      weaponName: this.weaponName, defBonus: this.defBonus,
      armorName: this.armorName, gold: this.gold, hunger: this.hunger,
      food: this.food, potions: this.potions, hasAmulet: this.hasAmulet,
      turns: this.turns, over: this.over, lesson: this.lesson,
      lastAction: this.lastAction, log: this.log, map: this.map,
      monsters: this.monsters, items: this.items, seen: this.seen,
      floors: this.floors
    };
  };

  Game.prototype.rand = function (lo, hi) {
    return randBetween(this.roll, lo, hi);
  };

  Game.prototype.act = function (action, post) {
    this.actions = [];
    this.actionNames = {};
    if (this.over !== "") {
      return;
    }
    post = post || {};
    if (action === "move") {
      var dx = post.dx | 0;
      var dy = post.dy | 0;
      if (dx < -1) dx = -1;
      if (dx > 1) dx = 1;
      if (dy < -1) dy = -1;
      if (dy > 1) dy = 1;
      if (dx === 0 && dy === 0) {
        this.waitTurn();
        return;
      }
      this.tryMove(dx, dy);
      return;
    }
    if (action === "wait") {
      this.waitTurn();
      return;
    }
    if (action === "eat") {
      this.eat();
      return;
    }
    if (action === "drink") {
      this.drink();
      return;
    }
    if (action === "climb") {
      this.climb(String(post.dir || ""));
    }
  };

  Game.prototype.attack = function () {
    return this.atkBase + this.weaponBonus;
  };

  Game.prototype.defense = function () {
    return this.defBonus;
  };

  Game.prototype.hungerWord = function () {
    if (this.hunger < 20) return "сыт";
    if (this.hunger < 30) return "проголодался";
    if (this.hunger < 50) return "очень голоден";
    return "голод опасен";
  };

  Game.prototype.tileHere = function () {
    return this.map[this.py][this.px].t;
  };

  Game.prototype.recentLog = function (count) {
    return this.log.slice(-count).reverse();
  };

  Game.prototype.viewRows = function () {
    var cols = 7;
    var rows = 9;
    var x0 = this.px - 3;
    var y0 = this.py - 4;
    if (x0 < 0) x0 = 0;
    if (y0 < 0) y0 = 0;
    if (x0 + cols > this.w) x0 = this.w - cols;
    if (y0 + rows > this.h) y0 = this.h - rows;
    var monsters = {};
    var i;
    for (i = 0; i < this.monsters.length; i++) {
      var monster = this.monsters[i];
      if (monster.hp > 0) {
        monsters[monster.x + "," + monster.y] = monster;
      }
    }
    var items = {};
    for (i = 0; i < this.items.length; i++) {
      items[this.items[i].x + "," + this.items[i].y] = this.items[i];
    }
    var out = [];
    var y;
    var x;
    for (y = y0; y < y0 + rows; y++) {
      var row = [];
      for (x = x0; x < x0 + cols; x++) {
        row.push(this.cellView(x, y, monsters, items));
      }
      out.push(row);
    }
    return out;
  };

  Game.prototype.tryMove = function (dx, dy) {
    var nx = this.px + dx;
    var ny = this.py + dy;
    if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h || this.map[ny][nx].t === "#") {
      this.note("wall");
      this.addLog("Тут стена.");
      this.finish();
      return;
    }
    var monster = this.monsterAt(nx, ny);
    if (monster !== null) {
      this.playerStrikes(monster);
      this.endTurn();
      return;
    }
    this.px = nx;
    this.py = ny;
    this.note("move");
    this.pickupHere();
    this.endTurn();
  };

  Game.prototype.waitTurn = function () {
    this.note("wait");
    this.addLog("Ты ждёшь.");
    this.endTurn();
  };

  Game.prototype.eat = function () {
    if (this.food <= 0) {
      this.addLog("Еды нет.");
      this.finish();
      return;
    }
    this.food--;
    this.hunger = 0;
    this.note("eat");
    this.addLog("Ты ешь. Голод отступил.");
    this.endTurn();
  };

  Game.prototype.drink = function () {
    if (this.potions <= 0) {
      this.addLog("Зелий нет.");
      this.finish();
      return;
    }
    this.potions--;
    var before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + 8);
    this.note("drink");
    this.addLog("Ты пьёшь зелье и восстанавливаешь " + (this.hp - before) + " здоровья.");
    this.endTurn();
  };

  Game.prototype.climb = function (dir) {
    var here = this.tileHere();
    if (dir === "down") {
      if (here !== ">") {
        this.addLog("Чтобы спуститься, встань на лестницу вниз.");
        this.finish();
        return;
      }
      if (this.depth >= 4) {
        this.addLog("Ниже уже нет этажа.");
        this.finish();
        return;
      }
      this.saveFloor();
      this.depth++;
      this.applyFloor(this.depth);
      this.standOn("<");
      this.note("stairs_down");
      this.addLog("Ты спускаешься. Этаж " + this.depth + ".");
      this.afterTravel();
      return;
    }
    if (dir === "up") {
      if (here !== "<") {
        this.addLog("Чтобы подняться, встань на лестницу вверх.");
        this.finish();
        return;
      }
      if (Number(this.depth) === 1) {
        if (!this.hasAmulet) {
          this.note("stairs_blocked");
          this.addLog("Без амулета выход ещё закрыт. Он лежит на 4 этаже.");
          this.finish();
          return;
        }
        this.over = "won";
        this.note("win");
        this.addLog("Ты вынес амулет на поверхность.");
        this.finish();
        return;
      }
      this.saveFloor();
      this.depth--;
      this.applyFloor(this.depth);
      this.standOn(">");
      this.note("stairs_up");
      this.addLog("Ты поднимаешься. Этаж " + this.depth + ".");
      this.afterTravel();
    }
  };

  Game.prototype.afterTravel = function () {
    if (this.over !== "") {
      this.finish();
      return;
    }
    this.hungerTick();
    this.reveal();
    this.turns++;
    this.finish();
  };

  Game.prototype.endTurn = function () {
    if (this.over !== "") {
      this.finish();
      return;
    }
    this.monstersAct();
    if (this.over !== "") {
      this.finish();
      return;
    }
    this.hungerTick();
    this.reveal();
    this.turns++;
    this.finish();
  };

  Game.prototype.playerStrikes = function (index) {
    var monster = this.monsters[index];
    if (this.rollHit(this.attack(), monster.def)) {
      var damage = this.rollDamage(this.attack());
      this.monsters[index].hp -= damage;
      this.addLog("Ты бьёшь " + monster.name + " на " + damage + ".");
      this.note("fight_hit", monster.name);
      if (this.monsters[index].hp <= 0) {
        this.addLog(monster.name + " побеждён.");
        this.note("kill", monster.name);
        if (this.rand(1, 100) <= 35) {
          this.items.push({
            x: monster.x,
            y: monster.y,
            kind: "gold",
            name: "золото",
            amount: this.rand(2, 8)
          });
        }
        this.monsters.splice(index, 1);
      }
      return;
    }
    this.addLog("Ты промахиваешься по " + monster.name + ".");
    this.note("fight_miss", monster.name);
  };

  Game.prototype.monstersAct = function () {
    var count = this.monsters.length;
    var i;
    for (i = 0; i < count; i++) {
      if (!this.monsters[i] || this.over !== "") {
        return;
      }
      var monster = this.monsters[i];
      var dx = this.px - monster.x;
      var dy = this.py - monster.y;
      var dist = Math.max(Math.abs(dx), Math.abs(dy));
      if (!this.monsterSees(monster)) {
        continue;
      }
      if (dist === 1) {
        this.monsterStrikes(i);
        continue;
      }
      var stepx = 0;
      var stepy = 0;
      if (dx !== 0) stepx = dx > 0 ? 1 : -1;
      if (dy !== 0) stepy = dy > 0 ? 1 : -1;
      var options = [];
      if (stepx !== 0 && stepy !== 0) options.push([stepx, stepy]);
      if (stepx !== 0) options.push([stepx, 0]);
      if (stepy !== 0) options.push([0, stepy]);
      var k;
      for (k = 0; k < options.length; k++) {
        if (this.canMonsterStep(monster, options[k][0], options[k][1])) {
          this.monsters[i].x += options[k][0];
          this.monsters[i].y += options[k][1];
          break;
        }
      }
    }
  };

  Game.prototype.monsterStrikes = function (index) {
    var monster = this.monsters[index];
    if (this.rollHit(monster.atk, this.defBonus)) {
      var damage = this.rollDamage(monster.atk);
      this.hp -= damage;
      this.addLog(monster.name + " бьёт тебя на " + damage + ".");
      this.note("monster_hit", monster.name);
      if (this.hp <= 0) {
        this.die();
      }
      return;
    }
    this.addLog(monster.name + " промахивается.");
  };

  Game.prototype.monsterSees = function (monster) {
    var dist = Math.max(Math.abs(this.px - monster.x), Math.abs(this.py - monster.y));
    if (dist > 6) return false;
    if (dist <= 1) return true;
    return this.los(monster.x, monster.y, this.px, this.py);
  };

  Game.prototype.canMonsterStep = function (monster, dx, dy) {
    var x = monster.x + dx;
    var y = monster.y + dy;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    if (this.map[y][x].t === "#") return false;
    if (x === this.px && y === this.py) return false;
    if (this.monsterAt(x, y) !== null) return false;
    return true;
  };

  Game.prototype.monsterAt = function (x, y) {
    var i;
    for (i = 0; i < this.monsters.length; i++) {
      var monster = this.monsters[i];
      if (monster.hp > 0 && monster.x === x && monster.y === y) {
        return i;
      }
    }
    return null;
  };

  Game.prototype.pickupHere = function () {
    var left = [];
    var i;
    for (i = 0; i < this.items.length; i++) {
      var item = this.items[i];
      if (item.x !== this.px || item.y !== this.py) {
        left.push(item);
        continue;
      }
      this.takeItem(item);
    }
    this.items = left;
  };

  Game.prototype.takeItem = function (item) {
    if (item.kind === "gold") {
      var amount = item.amount ? item.amount : 1;
      this.gold += amount;
      this.note("pickup_gold");
      this.addLog("Ты подбираешь золото: " + amount + ".");
      return;
    }
    if (item.kind === "potion") {
      this.potions++;
      this.note("pickup_potion");
      this.addLog("Ты подбираешь зелье лечения.");
      return;
    }
    if (item.kind === "food") {
      this.food++;
      this.note("pickup_food");
      this.addLog("Ты подбираешь еду.");
      return;
    }
    if (item.kind === "weapon") {
      var bonus = item.bonus ? item.bonus : 1;
      if (bonus > this.weaponBonus) {
        this.weaponBonus = bonus;
        this.weaponName = item.name;
        this.note("pickup_weapon", item.name);
        this.addLog("Ты берёшь в руки: " + item.name + ".");
      } else {
        this.addLog(item.name + " не лучше того, что уже надето.");
      }
      return;
    }
    if (item.kind === "armor") {
      var armorBonus = item.bonus ? item.bonus : 1;
      if (armorBonus > this.defBonus) {
        this.defBonus = armorBonus;
        this.armorName = item.name;
        this.note("pickup_armor", item.name);
        this.addLog("Ты надеваешь: " + item.name + ".");
      } else {
        this.addLog(item.name + " не крепче той, что уже надета.");
      }
      return;
    }
    if (item.kind === "amulet") {
      this.hasAmulet = true;
      this.note("pickup_amulet");
      this.addLog("Ты поднимаешь Амулет Йендора.");
    }
  };

  Game.prototype.hungerTick = function () {
    this.hunger++;
    if (this.hunger === 30) {
      this.note("hungry");
      this.addLog("Ты проголодался.");
    }
    if (this.hunger >= 50) {
      this.note("very_hungry");
      this.hp -= 1;
      this.addLog("Голод отнимает 1 здоровье.");
      if (this.hp <= 0) {
        this.die();
      }
    }
  };

  Game.prototype.die = function () {
    this.hp = 0;
    this.over = "dead";
    this.note("dead");
    this.addLog("Ты погиб.");
  };

  Game.prototype.rollHit = function (attack, defense) {
    var chance = 58 + (attack - defense) * 8;
    if (chance < 20) chance = 20;
    if (chance > 95) chance = 95;
    return this.rand(1, 100) <= chance;
  };

  Game.prototype.rollDamage = function (attack) {
    var power = Math.max(1, attack | 0);
    return this.rand(1, power);
  };

  Game.prototype.reveal = function () {
    this.visible = {};
    var room = this.map[this.py][this.px].room;
    var y;
    var x;
    var dy;
    var dx;
    if (room > 0) {
      for (y = 0; y < this.h; y++) {
        for (x = 0; x < this.w; x++) {
          if (this.map[y][x].room !== room) continue;
          for (dy = -1; dy <= 1; dy++) {
            for (dx = -1; dx <= 1; dx++) {
              this.markVisible(x + dx, y + dy);
            }
          }
        }
      }
    } else {
      for (dy = -2; dy <= 2; dy++) {
        for (dx = -2; dx <= 2; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) > 2) continue;
          x = this.px + dx;
          y = this.py + dy;
          if (this.los(this.px, this.py, x, y)) {
            this.markVisible(x, y);
          }
        }
      }
    }
    this.markVisible(this.px, this.py);
  };

  Game.prototype.markVisible = function (x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.visible[x + "," + y] = true;
    this.seen[y][x] = true;
  };

  Game.prototype.los = function (x0, y0, x1, y1) {
    if (x1 < 0 || y1 < 0 || x1 >= this.w || y1 >= this.h) return false;
    var dx = Math.abs(x1 - x0);
    var dy = Math.abs(y1 - y0);
    var sx = x0 < x1 ? 1 : -1;
    var sy = y0 < y1 ? 1 : -1;
    var err = dx - dy;
    var x = x0;
    var y = y0;
    while (x !== x1 || y !== y1) {
      var e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
      if (x === x1 && y === y1) break;
      if (!this.map[y] || !this.map[y][x] || this.map[y][x].t === "#") return false;
    }
    return true;
  };

  Game.prototype.cellView = function (x, y, monsters, items) {
    var key = x + "," + y;
    var visible = !!this.visible[key];
    var seen = !!(this.seen[y] && this.seen[y][x]);
    var dx = x - this.px;
    var dy = y - this.py;
    var press = Math.max(Math.abs(dx), Math.abs(dy)) === 1;
    var terrain = this.map[y][x].t;
    var glyph = "";
    var css = "fog";
    var label = "Тьма";
    if (x === this.px && y === this.py) {
      glyph = "@";
      css = "player";
      label = "Ты";
      press = false;
    } else if (visible && monsters[key]) {
      glyph = monsters[key].letter;
      css = "mon mon-" + monsters[key].letter;
      label = monsters[key].name;
    } else if (visible && items[key]) {
      glyph = itemGlyph(items[key].kind);
      css = "item";
      label = items[key].name;
    } else if (visible || seen) {
      if (terrain === "#") {
        glyph = "#";
        css = visible ? "wall" : "wall dim";
        label = "Стена";
      } else if (terrain === "<") {
        glyph = "<";
        css = visible ? "stairs" : "stairs dim";
        label = "Лестница вверх";
      } else if (terrain === ">") {
        glyph = ">";
        css = visible ? "stairs" : "stairs dim";
        label = "Лестница вниз";
      } else {
        glyph = "·";
        css = visible ? "floor" : "floor dim";
        label = "Пол";
      }
    }
    return { x: x, y: y, dx: dx, dy: dy, glyph: glyph, css: css, label: label, press: press };
  };

  Game.prototype.saveFloor = function () {
    if (this.depth < 1 || !this.map || this.map.length === 0) return;
    this.floors[this.depth] = {
      map: this.map,
      monsters: this.monsters,
      items: this.items,
      seen: this.seen
    };
  };

  Game.prototype.applyFloor = function (depth) {
    var pack = this.floors[depth];
    this.map = pack.map;
    this.monsters = pack.monsters;
    this.items = pack.items;
    this.seen = pack.seen;
    this.visible = {};
    this.depth = depth;
  };

  Game.prototype.standOn = function (glyph) {
    var y;
    var x;
    for (y = 0; y < this.h; y++) {
      for (x = 0; x < this.w; x++) {
        if (this.map[y][x].t === glyph) {
          this.px = x;
          this.py = y;
          var index = this.monsterAt(x, y);
          if (index !== null) this.shoveMonster(index);
          return;
        }
      }
    }
  };

  Game.prototype.shoveMonster = function (index) {
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    var i;
    for (i = 0; i < dirs.length; i++) {
      if (this.canMonsterStep(this.monsters[index], dirs[i][0], dirs[i][1])) {
        this.monsters[index].x += dirs[i][0];
        this.monsters[index].y += dirs[i][1];
        return;
      }
    }
    this.monsters.splice(index, 1);
  };

  Game.prototype.note = function (action, name) {
    this.actions.push(action);
    if (name) this.actionNames[action] = name;
  };

  Game.prototype.addLog = function (text) {
    this.log.push(text);
    if (this.log.length > 40) this.log = this.log.slice(-40);
  };

  Game.prototype.finish = function () {
    var pair = root.lessonForTurn
      ? root.lessonForTurn(this.actions, { names: this.actionNames })
      : ["", ""];
    this.lastAction = pair[0] || "";
    this.lesson = pair[1] || "";
  };

  function itemGlyph(kind) {
    var glyphs = { gold: "*", potion: "!", food: "%", weapon: ")", armor: "[", amulet: "♦" };
    return glyphs[kind] || "?";
  }

  function makeFloor(depth, w, h, roll) {
    function ri(lo, hi) {
      return randBetween(roll, lo, hi);
    }
    var attempt;
    for (attempt = 0; attempt < 40; attempt++) {
      var map = [];
      var y;
      var x;
      for (y = 0; y < h; y++) {
        map[y] = [];
        for (x = 0; x < w; x++) {
          map[y][x] = { t: "#", room: 0 };
        }
      }
      var rooms = [];
      var n;
      for (n = 0; n < 50 && rooms.length < 7; n++) {
        var rw = ri(4, 8);
        var rh = ri(3, 5);
        var rx = ri(1, w - rw - 2);
        var ry = ri(1, h - rh - 2);
        var candidate = { x: rx, y: ry, w: rw, h: rh, id: rooms.length + 1 };
        var hits = false;
        var r;
        for (r = 0; r < rooms.length; r++) {
          if (roomsOverlap(candidate, rooms[r])) {
            hits = true;
            break;
          }
        }
        if (hits) continue;
        rooms.push(candidate);
        var yy;
        var xx;
        for (yy = ry; yy < ry + rh; yy++) {
          for (xx = rx; xx < rx + rw; xx++) {
            map[yy][xx] = { t: ".", room: candidate.id };
          }
        }
      }
      if (rooms.length < 4) continue;
      var i;
      for (i = 1; i < rooms.length; i++) {
        carveCorridor(
          map,
          rooms[i - 1].x + Math.floor(rooms[i - 1].w / 2),
          rooms[i - 1].y + Math.floor(rooms[i - 1].h / 2),
          rooms[i].x + Math.floor(rooms[i].w / 2),
          rooms[i].y + Math.floor(rooms[i].h / 2)
        );
      }
      if (!isConnected(map)) continue;
      var upCells = dotCells(map, rooms[0].id);
      var downCells = dotCells(map, rooms[rooms.length - 1].id);
      if (upCells.length < 2 || downCells.length < 1) continue;
      var upCell = upCells[ri(0, upCells.length - 1)];
      map[upCell[1]][upCell[0]].t = "<";
      var downCell = null;
      if (depth < 4) {
        var pool = [];
        for (i = 0; i < downCells.length; i++) {
          if (downCells[i][0] !== upCell[0] || downCells[i][1] !== upCell[1]) {
            pool.push(downCells[i]);
          }
        }
        if (pool.length === 0) continue;
        downCell = pool[ri(0, pool.length - 1)];
        map[downCell[1]][downCell[0]].t = ">";
      }
      var start = null;
      if (depth === 1) {
        var dots = dotCells(map, rooms[0].id);
        for (i = 0; i < dots.length; i++) {
          if (map[dots[i][1]][dots[i][0]].t === ".") {
            start = dots[i];
            break;
          }
        }
        if (!start) continue;
      }
      var occupied = {};
      occupied[upCell[0] + "," + upCell[1]] = true;
      if (downCell) occupied[downCell[0] + "," + downCell[1]] = true;
      if (start) occupied[start[0] + "," + start[1]] = true;
      var spots = openSpots(map, occupied);
      shuffle(spots, ri);
      var monsters = [];
      var kinds = monsterPool(depth);
      var monsterCount = 3 + depth;
      for (i = 0; i < monsterCount && spots.length > 0; i++) {
        var spot = spots.pop();
        var proto = kinds[ri(0, kinds.length - 1)];
        monsters.push({
          x: spot[0], y: spot[1], hp: proto.hp, max: proto.hp,
          atk: proto.atk, def: proto.def, letter: proto.letter, name: proto.name
        });
      }
      var plan = [
        { kind: "food", name: "еда", n: 2 },
        { kind: "potion", name: "зелье лечения", n: 2 },
        { kind: "gold", name: "золото", n: 2 }
      ];
      if (depth === 1) plan.push({ kind: "weapon", name: "кинжал", bonus: 2, n: 1 });
      if (depth === 2) plan.push({ kind: "armor", name: "кожаная броня", bonus: 2, n: 1 });
      if (depth === 3) {
        plan.push({ kind: "weapon", name: "короткий меч", bonus: 4, n: 1 });
        plan.push({ kind: "armor", name: "кольчуга", bonus: 3, n: 1 });
      }
      if (depth === 4) plan.push({ kind: "amulet", name: "Амулет Йендора", n: 1 });
      var items = [];
      var p;
      for (p = 0; p < plan.length; p++) {
        var entry = plan[p];
        var k;
        for (k = 0; k < entry.n; k++) {
          if (spots.length === 0) break;
          spot = spots.pop();
          var item = { x: spot[0], y: spot[1], kind: entry.kind, name: entry.name };
          if (entry.kind === "gold") item.amount = ri(4, 15);
          if (entry.bonus !== undefined) item.bonus = entry.bonus;
          items.push(item);
        }
      }
      if (depth === 4) {
        var hasAmulet = false;
        for (i = 0; i < items.length; i++) {
          if (items[i].kind === "amulet") hasAmulet = true;
        }
        if (!hasAmulet) continue;
      }
      var seen = [];
      for (y = 0; y < h; y++) {
        seen[y] = [];
        for (x = 0; x < w; x++) seen[y][x] = false;
      }
      return { map: map, monsters: monsters, items: items, seen: seen, start: start };
    }
    throw new Error("Не получилось собрать этаж Rogue.");
  }

  function monsterPool(depth) {
    var all = [
      { letter: "B", name: "летучая мышь", hp: 4, atk: 2, def: 0 },
      { letter: "S", name: "змея", hp: 6, atk: 3, def: 0 },
      { letter: "G", name: "гоблин", hp: 8, atk: 3, def: 1 },
      { letter: "O", name: "орк", hp: 11, atk: 4, def: 1 },
      { letter: "T", name: "тролль", hp: 16, atk: 5, def: 2 }
    ];
    if (depth <= 1) return [all[0], all[1], all[2]];
    if (depth === 2) return [all[1], all[2], all[3]];
    if (depth === 3) return [all[2], all[3], all[4]];
    return [all[3], all[4]];
  }

  function roomsOverlap(a, b) {
    return a.x - 1 < b.x + b.w && b.x - 1 < a.x + a.w && a.y - 1 < b.y + b.h && b.y - 1 < a.y + a.h;
  }

  function carveCorridor(map, x1, y1, x2, y2) {
    var x = x1;
    var y = y1;
    function paint() {
      if (map[y][x].t === "#") map[y][x] = { t: ".", room: 0 };
    }
    paint();
    while (x !== x2) {
      x += x2 > x ? 1 : -1;
      paint();
    }
    while (y !== y2) {
      y += y2 > y ? 1 : -1;
      paint();
    }
  }

  function isConnected(map) {
    var h = map.length;
    var w = map[0].length;
    var start = null;
    var total = 0;
    var y;
    var x;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        if (map[y][x].t === "#") continue;
        total++;
        if (!start) start = [x, y];
      }
    }
    if (!start) return false;
    var seen = {};
    var stack = [start];
    seen[start[0] + "," + start[1]] = true;
    var count = 0;
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (stack.length > 0) {
      var cell = stack.pop();
      count++;
      var d;
      for (d = 0; d < dirs.length; d++) {
        var nx = cell[0] + dirs[d][0];
        var ny = cell[1] + dirs[d][1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (map[ny][nx].t === "#") continue;
        var key = nx + "," + ny;
        if (seen[key]) continue;
        seen[key] = true;
        stack.push([nx, ny]);
      }
    }
    return count === total;
  }

  function dotCells(map, roomId) {
    var cells = [];
    var y;
    var x;
    for (y = 0; y < map.length; y++) {
      for (x = 0; x < map[y].length; x++) {
        if (map[y][x].room === roomId && map[y][x].t === ".") cells.push([x, y]);
      }
    }
    return cells;
  }

  function openSpots(map, occupied) {
    var spots = [];
    var y;
    var x;
    for (y = 0; y < map.length; y++) {
      for (x = 0; x < map[y].length; x++) {
        if (map[y][x].t !== ".") continue;
        if (occupied[x + "," + y]) continue;
        spots.push([x, y]);
      }
    }
    return spots;
  }

  function shuffle(list, ri) {
    var i;
    for (i = list.length - 1; i > 0; i--) {
      var j = ri(0, i);
      var tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
  }

  function esc(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function render(game) {
    var html = "";
    if (game.over === "dead") {
      html += '<p class="banner bad end-banner">Партия окончена. Можно начать заново.</p>';
    } else if (game.over === "won") {
      html += '<p class="banner good end-banner">Победа. Амулет снаружи.</p>';
    }
    var hpPercent = Math.round(100 * game.hp / Math.max(1, game.maxHp));
    html += '<div class="rogue-layout">';
    html += '<section class="stats">';
    html += '<div class="stat"><span>Этаж</span>' + game.depth + " / 4</div>";
    html += '<div class="stat"><span>Здоровье</span>' + game.hp + " / " + game.maxHp + "</div>";
    html += '<div class="hp" aria-hidden="true"><i style="width: ' + hpPercent + '%"></i></div>';
    html += '<div class="stat"><span>Атака</span>' + game.attack() + "</div>";
    html += '<div class="stat"><span>Защита</span>' + game.defense() + "</div>";
    html += '<div class="stat"><span>Золото</span>' + game.gold + "</div>";
    html += '<div class="stat"><span>Голод</span>' + esc(game.hungerWord()) + "</div>";
    html += '<div class="stat"><span>Оружие</span>' + esc(game.weaponName) + "</div>";
    html += '<div class="stat"><span>Броня</span>' + esc(game.armorName) + "</div>";
    html += '<div class="stat"><span>Амулет</span>' + (game.hasAmulet ? "есть" : "нет") + "</div>";
    html += "</section>";
    html += '<aside class="lesson-panel" id="lesson-note"><h2>Заметка к ходу</h2>';
    if (game.lesson) {
      html += "<p>" + esc(game.lesson) + "</p>";
    } else {
      html += '<p class="muted">Сделай ход — здесь появится короткое пояснение.</p>';
    }
    html += "</aside>";
    html += "<!-- Действие этого хода: " + esc(game.lastAction) + ". Текст задаётся в assets/js/lesson.js -->";
    html += '<div class="dungeon-wrap"><div class="dungeon" aria-label="Карта подземелья">';
    var rows = game.viewRows();
    var r;
    var c;
    for (r = 0; r < rows.length; r++) {
      for (c = 0; c < rows[r].length; c++) {
        var cell = rows[r][c];
        html += '<div class="dcell ' + esc(cell.css) + '">';
        if (cell.press && game.over === "") {
          html += '<button type="button" data-act="move" data-dx="' + cell.dx + '" data-dy="' + cell.dy + '" aria-label="' + esc(cell.label) + '">' + esc(cell.glyph) + "</button>";
        } else {
          html += '<span aria-label="' + esc(cell.label) + '">' + esc(cell.glyph) + "</span>";
        }
        html += "</div>";
      }
    }
    html += "</div></div>";
    html += '<section class="log"><h2>Последние события</h2><ol>';
    var lines = game.recentLog(8);
    for (r = 0; r < lines.length; r++) {
      html += "<li>" + esc(lines[r]) + "</li>";
    }
    html += "</ol></section>";
    html += '<form class="restart-form"><button class="btn" type="button" data-act="restart">Новая игра</button></form>';
    if (game.over === "") {
      html += '<div class="rogue-controls"><div class="pad">';
      var pad = [
        [-1, -1, "↖", "y"], [0, -1, "↑", "k"], [1, -1, "↗", "u"],
        [-1, 0, "←", "h"], [0, 0, "·", "."], [1, 0, "→", "l"],
        [-1, 1, "↙", "b"], [0, 1, "↓", "j"], [1, 1, "↘", "n"]
      ];
      for (r = 0; r < pad.length; r++) {
        var key = pad[r];
        var wait = key[0] === 0 && key[1] === 0;
        html += '<button class="pad-btn" type="button" accesskey="' + esc(key[3]) + '" data-act="' + (wait ? "wait" : "move") + '" data-dx="' + key[0] + '" data-dy="' + key[1] + '">' + esc(key[2]) + "<span>" + esc(key[3]) + "</span></button>";
      }
      html += '</div><div class="pack-actions">';
      html += '<button class="btn quiet" type="button" data-act="eat" accesskey="e">Съесть еду (' + game.food + ")</button>";
      html += '<button class="btn quiet" type="button" data-act="drink" accesskey="q">Выпить зелье (' + game.potions + ")</button>";
      if (game.tileHere() === ">") {
        html += '<button class="btn blue" type="button" data-act="climb" data-dir="down">Спуститься</button>';
      }
      if (game.tileHere() === "<") {
        html += '<button class="btn blue" type="button" data-act="climb" data-dir="up">Подняться</button>';
      }
      html += "</div></div>";
    }
    html += "</div>";
    return html;
  }

  function boot() {
    var stage = document.getElementById("rogue-stage");
    if (!stage) return;
    var game;
    try {
      var raw = localStorage.getItem("pau-rogue");
      game = raw ? Game.fromState(JSON.parse(raw)) : Game.create(1 + Math.floor(Math.random() * 999999));
    } catch (error) {
      game = Game.create(1 + Math.floor(Math.random() * 999999));
    }
    function persist() {
      try {
        localStorage.setItem("pau-rogue", JSON.stringify(game.toState()));
      } catch (error) {}
    }
    function draw() {
      stage.innerHTML = render(game);
    }
    stage.addEventListener("click", function (event) {
      var button = event.target.closest ? event.target.closest("button") : null;
      if (!button || !stage.contains(button)) return;
      event.preventDefault();
      var act = button.getAttribute("data-act");
      if (act === "restart") {
        game = Game.create(1 + Math.floor(Math.random() * 999999));
      } else if (act) {
        game.act(act, {
          dx: Number(button.getAttribute("data-dx") || 0),
          dy: Number(button.getAttribute("data-dy") || 0),
          dir: button.getAttribute("data-dir") || ""
        });
      }
      persist();
      draw();
    });
    persist();
    draw();
  }

  root.RogueGame = Game;
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot);
    } else {
      boot();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
