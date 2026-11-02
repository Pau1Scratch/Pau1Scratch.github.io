/*
 * Плитки Вана. Четыре уровня считаются в браузере, без PHP.
 * Позиции запоминаются в localStorage, ключ pau-wang.
 * Уровни открываются ссылками tiles.html?level=1 … 4.
 * Кнопки хода страницу не перезагружают.
 *
 * Метка стороны бывает цветом, числом 0/1, словом местности или fade1…fade9.
 * Общая сторона двух плиток несёт одну и ту же метку.
 * Цвета 1–9 стыкуются с собой и с соседним номером.
 * Плитку нельзя поворачивать: север остаётся севером.
 */
(function (root) {
  var STORAGE_KEY = "pau-wang";
  var grassSerial = 0;
  var FONT = "Trebuchet MS, Segoe UI, sans-serif";
  var DIRS = ["N", "E", "S", "W"];
  var WEDGES = {
    N: "2,2 98,2 50,50",
    E: "98,2 98,98 50,50",
    S: "2,98 98,98 50,50",
    W: "2,2 2,98 50,50"
  };
  var GRASS_MATRICES = [
    "1.10 0.20 0 0 0.12  0 1.15 0 0 0.10  0 0.08 0.55 0 0.04  0 0 0 1 0",
    "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0",
    "0.42 0.05 0 0 0  0 0.50 0 0 0  0 0.02 0.30 0 0  0 0 0 1 0",
    "0.28 0.05 0 0 0  0 0.36 0 0 0  0 0.02 0.20 0 0  0 0 0 1 0"
  ];
  var SHOWCASE = [
    ["g0", "g0", "g0", "g0"],
    ["g1", "g1", "g1", "g1"],
    ["g2", "g2", "g2", "g2"],
    ["g0", "g1", "g2", "g1"],
    ["g2", "g2", "g0", "g0"],
    ["g1", "g0", "g1", "g2"],
    ["water", "water", "water", "water"],
    ["water", "g1", "g1", "g1"],
    ["g1", "water", "g1", "g1"],
    ["g0", "g0", "water", "g0"],
    ["river", "g1", "g0", "g1"],
    ["g1", "river", "g1", "g0"],
    ["river", "g1", "river", "g2"],
    ["g0", "river", "g1", "river"],
    ["river", "river", "g1", "g0"],
    ["g2", "g1", "river", "river"],
    ["river", "river", "g1", "river"],
    ["river", "river", "river", "river"],
    ["road", "g1", "g0", "g1"],
    ["g1", "road", "g1", "g0"],
    ["road", "g1", "road", "g2"],
    ["g0", "road", "g1", "road"],
    ["road", "road", "g1", "g0"],
    ["g2", "g1", "road", "road"],
    ["road", "road", "g1", "road"],
    ["road", "road", "road", "road"]
  ];

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

  function makeRng(roll) {
    function int(lo, hi) {
      return lo + Math.floor(roll() * (hi - lo + 1));
    }
    return {
      int: int,
      shuffle: function (list) {
        var i, j, tmp;
        for (i = list.length - 1; i > 0; i--) {
          j = int(0, i);
          tmp = list[i];
          list[i] = list[j];
          list[j] = tmp;
        }
        return list;
      }
    };
  }

  function mathRng() {
    return makeRng(Math.random);
  }

  function seededRng(seed) {
    return makeRng(mulberry32(seed >>> 0));
  }

  function hasKey(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  function cloneLabel(label) {
    if (label !== null && label !== undefined && typeof label === "object") {
      return { color: label.color, height: label.height };
    }
    return label;
  }

  function tile(id, edges, kind) {
    return {
      id: String(id),
      edges: {
        N: cloneLabel(edges.N),
        E: cloneLabel(edges.E),
        S: cloneLabel(edges.S),
        W: cloneLabel(edges.W)
      },
      kind: String(kind),
      view: {},
      fixed: true
    };
  }

  function isLabelObject(value) {
    return value !== null && typeof value === "object";
  }

  function sortedLabel(label) {
    var keys = Object.keys(label).sort();
    var out = {};
    var i;
    for (i = 0; i < keys.length; i++) out[keys[i]] = label[keys[i]];
    return out;
  }

  function labelsEqual(a, b) {
    if (isLabelObject(a) || isLabelObject(b)) {
      if (!isLabelObject(a) || !isLabelObject(b)) return false;
      return JSON.stringify(sortedLabel(a)) === JSON.stringify(sortedLabel(b));
    }
    return a === b;
  }

  function fadeNumber(label) {
    if (typeof label === "string" && label.length === 5 && label.substring(0, 4) === "fade") {
      var n = parseInt(label.substring(4, 5), 10);
      if (n >= 1 && n <= 9) return n;
    }
    return null;
  }

  function fadePartners(color) {
    color = color | 0;
    var partners = [];
    if (color > 1) partners.push(color - 1);
    if (color >= 1 && color <= 9) partners.push(color);
    if (color < 9) partners.push(color + 1);
    return partners;
  }

  function labelText(label) {
    if (isLabelObject(label)) {
      var colors = ["светло-зелёный", "зелёный", "тёмно-зелёный", "очень тёмный"];
      var heights = ["очень низкая", "низкая", "высокая", "очень высокая"];
      var color = label.color | 0;
      var height = label.height | 0;
      if (color < 0 || color > 3) color = 0;
      if (height < 0 || height > 3) height = 0;
      return "цвет «" + colors[color] + "», высота «" + heights[height] + "»";
    }
    var fade = fadeNumber(label);
    if (fade !== null) {
      return "цвет " + fade + " (рядом " + fadePartners(fade).join(" или ") + ")";
    }
    if (label === 0 || label === "0") return "0 (дороги нет)";
    if (label === 1 || label === "1") return "1 (дорога есть)";
    var names = {
      red: "красный",
      blue: "синий",
      yellow: "жёлтый",
      green: "зелёный",
      orange: "оранжевый",
      g0: "светлая трава",
      g1: "трава",
      g2: "тёмная трава",
      road: "дорога",
      river: "река",
      water: "вода"
    };
    var key = String(label);
    if (hasKey(names, key)) return names[key];
    return key;
  }

  function tileLabel(one) {
    if (one.kind === "fade") {
      var n = fadeNumber(one.edges.N);
      if (n === null) n = 1;
      return "Цвет " + n + ". Стыкуется с " + fadePartners(n).join(" и ") + ".";
    }
    var edges = one.edges;
    return "Север: " + labelText(edges.N) + ". Восток: " + labelText(edges.E) + ". Юг: " + labelText(edges.S) + ". Запад: " + labelText(edges.W) + ".";
  }

  function intersect(a, b) {
    var set = {};
    var out = [];
    var i;
    for (i = 0; i < b.length; i++) set[b[i]] = true;
    for (i = 0; i < a.length; i++) {
      if (set[a[i]]) out.push(a[i]);
    }
    return out;
  }

  function contains(list, value) {
    var i;
    for (i = 0; i < list.length; i++) {
      if (list[i] === value) return true;
    }
    return false;
  }

  function range19() {
    return [1, 2, 3, 4, 5, 6, 7, 8, 9];
  }

  function fadeTile(id, color) {
    color = color | 0;
    if (color < 1) color = 1;
    if (color > 9) color = 9;
    var label = "fade" + color;
    return tile(id, { N: label, E: label, S: label, W: label }, "fade");
  }

  function fadeChoices(board, x, y) {
    var around = [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]];
    var choices = range19();
    var saw = false;
    var i, key, n;
    for (i = 0; i < around.length; i++) {
      key = around[i][0] + "," + around[i][1];
      if (!hasKey(board, key)) continue;
      saw = true;
      n = fadeNumber(board[key].edges.N);
      if (n === null) return [];
      choices = intersect(choices, fadePartners(n));
    }
    if (!saw) return range19();
    return choices;
  }

  function fadeFill(colors, w, h, index, steps, rng) {
    if (index >= w * h) return true;
    steps.n += 1;
    if (steps.n > 20000) return false;
    var x = index % w;
    var y = Math.floor(index / w);
    var options = range19();
    if (x > 0) options = intersect(options, fadePartners(colors[y][x - 1]));
    if (y > 0) options = intersect(options, fadePartners(colors[y - 1][x]));
    rng.shuffle(options);
    var i;
    for (i = 0; i < options.length; i++) {
      colors[y][x] = options[i];
      if (fadeFill(colors, w, h, index + 1, steps, rng)) return true;
    }
    colors[y][x] = 0;
    return false;
  }

  function generateFade(w, h, rng) {
    var colors = [];
    var y, x;
    for (y = 0; y < h; y++) {
      colors[y] = [];
      for (x = 0; x < w; x++) colors[y][x] = 0;
    }
    var steps = { n: 0 };
    var ok = fadeFill(colors, w, h, 0, steps, rng);
    if (!ok) {
      for (y = 0; y < h; y++) {
        for (x = 0; x < w; x++) colors[y][x] = ((x + y) % 2 === 0) ? 4 : 5;
      }
    }
    var placed = {};
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        placed[x + "," + y] = fadeTile("f" + x + "x" + y, colors[y][x]);
      }
    }
    return placed;
  }

  function partnerPhrase(color) {
    var partners = fadePartners(color);
    var names = partners.slice();
    var last = names.pop();
    if (names.length === 0) return "цветом " + last;
    return "цветами " + names.join(", ") + " или " + last;
  }

  function fadePlacementError(board, x, y, one) {
    var mine = fadeNumber(one.edges.N);
    if (mine === null) return "У этой плитки нет цвета.";
    var around = [
      [x, y - 1, "сверху"],
      [x + 1, y, "справа"],
      [x, y + 1, "снизу"],
      [x - 1, y, "слева"]
    ];
    var allowed = partnerPhrase(mine);
    var partners = fadePartners(mine);
    var saw = false;
    var i, key, theirs, got;
    for (i = 0; i < around.length; i++) {
      key = around[i][0] + "," + around[i][1];
      if (!hasKey(board, key)) continue;
      saw = true;
      theirs = fadeNumber(board[key].edges.N);
      got = theirs === null ? "другой" : String(theirs);
      if (theirs === null || !contains(partners, theirs)) {
        return "Цвет " + mine + " встаёт только рядом с " + allowed + ". У соседа " + around[i][2] + " цвет " + got + ", поэтому плитка вернулась вниз.";
      }
    }
    if (!saw && Object.keys(board).length > 0) {
      return "Эту плитку можно ставить только рядом с уже стоящей.";
    }
    return null;
  }

  function placementError(board, x, y, one) {
    var key = x + "," + y;
    if (hasKey(board, key)) return "Эта клетка уже занята.";
    if (one.kind === "fade") return fadePlacementError(board, x, y, one);
    var around = {
      N: [x, y - 1, "S", "сверху"],
      E: [x + 1, y, "W", "справа"],
      S: [x, y + 1, "N", "снизу"],
      W: [x - 1, y, "E", "слева"]
    };
    var sideName = { N: "Северная", E: "Восточная", S: "Южная", W: "Западная" };
    var theirName = { N: "северная", E: "восточная", S: "южная", W: "западная" };
    var saw = false;
    var i, dir, info, neighborKey, neighbor, mine, theirs;
    for (i = 0; i < DIRS.length; i++) {
      dir = DIRS[i];
      info = around[dir];
      neighborKey = info[0] + "," + info[1];
      if (!hasKey(board, neighborKey)) continue;
      saw = true;
      neighbor = board[neighborKey];
      mine = one.edges[dir];
      theirs = neighbor.edges[info[2]];
      if (!labelsEqual(mine, theirs)) {
        return sideName[dir] + " сторона твоей плитки — " + labelText(mine) + ". У соседа " + info[3] + " " + theirName[info[2]] + " сторона — " + labelText(theirs) + ". По правилам плиток Вана эти стороны должны совпасть, поэтому плитка вернулась вниз.";
      }
    }
    if (!saw && Object.keys(board).length > 0) {
      return "Эту плитку можно ставить только рядом с уже стоящей.";
    }
    return null;
  }

  function openSlots(board) {
    var slots = {};
    var keys = Object.keys(board);
    var steps = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    var i, n, parts, x, y, nx, ny, slotKey;
    for (i = 0; i < keys.length; i++) {
      parts = keys[i].split(",");
      x = parseInt(parts[0], 10);
      y = parseInt(parts[1], 10);
      for (n = 0; n < steps.length; n++) {
        nx = x + steps[n][0];
        ny = y + steps[n][1];
        slotKey = nx + "," + ny;
        if (!hasKey(board, slotKey)) slots[slotKey] = [nx, ny];
      }
    }
    return slots;
  }

  function hasLegalPlacement(board, tray) {
    if (tray.length === 0) return true;
    if (Object.keys(board).length === 0) return true;
    var slots = openSlots(board);
    var keys = Object.keys(slots);
    var i, j, slot;
    for (i = 0; i < tray.length; i++) {
      for (j = 0; j < keys.length; j++) {
        slot = slots[keys[j]];
        if (placementError(board, slot[0], slot[1], tray[i]) === null) return true;
      }
    }
    return false;
  }

  function blankEdges(w, h) {
    var hEdge = [];
    var vEdge = [];
    var y, x;
    for (y = 0; y <= h; y++) {
      hEdge[y] = [];
      for (x = 0; x < w; x++) hEdge[y][x] = null;
    }
    for (y = 0; y < h; y++) {
      vEdge[y] = [];
      for (x = 0; x <= w; x++) vEdge[y][x] = null;
    }
    return { hEdge: hEdge, vEdge: vEdge };
  }

  function rollLabel(kind, rng) {
    if (kind === "road") return rng.int(0, 1);
    if (kind === "grass") return { color: rng.int(0, 3), height: rng.int(0, 3) };
    return "g" + rng.int(0, 2);
  }

  function explainStep(x, y, edges, fromNeighbor, kind) {
    var names = {
      N: ["Север", "у соседа сверху"],
      E: ["Восток", "у соседа справа"],
      S: ["Юг", "у соседа снизу"],
      W: ["Запад", "у соседа слева"]
    };
    var bits = [];
    var i, dir, how;
    for (i = 0; i < DIRS.length; i++) {
      dir = DIRS[i];
      how = fromNeighbor[dir] ? "взяли " + names[dir][1] : "алгоритм выбрал сам";
      bits.push(names[dir][0] + " " + how + ": " + labelText(edges[dir]));
    }
    var rule = "Общая сторона двух плиток обязана совпасть.";
    if (kind === "road") rule = "На дороге правило то же: 0 стыкуется только с 0, а 1 только с 1.";
    return "Клетка, столбец " + (x + 1) + ", ряд " + (y + 1) + ". " + bits.join(". ") + ". " + rule;
  }

  function placeNext(hEdge, vEdge, placed, w, h, kind, rng) {
    var y, x, key, i, dir, loc, current, already, edges, fromNeighbor;
    var spec;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        key = x + "," + y;
        if (hasKey(placed, key)) continue;
        spec = {
          N: ["h", y, x],
          E: ["v", y, x + 1],
          S: ["h", y + 1, x],
          W: ["v", y, x]
        };
        edges = {};
        fromNeighbor = {};
        for (i = 0; i < DIRS.length; i++) {
          dir = DIRS[i];
          loc = spec[dir];
          if (loc[0] === "h") current = hEdge[loc[1]][loc[2]];
          else current = vEdge[loc[1]][loc[2]];
          already = current !== null && current !== undefined;
          if (!already) {
            current = rollLabel(kind, rng);
            if (loc[0] === "h") hEdge[loc[1]][loc[2]] = current;
            else vEdge[loc[1]][loc[2]] = current;
          }
          edges[dir] = cloneLabel(current);
          fromNeighbor[dir] = already;
        }
        placed[key] = tile("p" + x + "x" + y + "k" + Object.keys(placed).length, edges, kind);
        return {
          done: false,
          explain: explainStep(x, y, edges, fromNeighbor, kind),
          x: x,
          y: y
        };
      }
    }
    return {
      done: true,
      explain: "Карта собрана. Все соседние стороны совпадают, тупика нет.",
      x: null,
      y: null
    };
  }

  function fillAll(hEdge, vEdge, placed, w, h, kind, rng) {
    var explain = "";
    var limit = w * h + 2;
    var guard, step;
    for (guard = 0; guard < limit; guard++) {
      step = placeNext(hEdge, vEdge, placed, w, h, kind, rng);
      explain = step.explain;
      if (step.done) return explain;
    }
    return explain;
  }

  function gridFromPlaced(placed, w, h) {
    var grid = [];
    var y, x;
    for (y = 0; y < h; y++) {
      grid[y] = [];
      for (x = 0; x < w; x++) grid[y][x] = placed[x + "," + y];
    }
    return grid;
  }

  function seamError(grid) {
    var h = grid.length;
    if (h === 0) return "Пустая карта.";
    var w = grid[0].length;
    var y, x, one, right, below;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        one = grid[y][x];
        if (x + 1 < w) {
          right = grid[y][x + 1];
          if (!labelsEqual(one.edges.E, right.edges.W)) return "Шов " + x + "," + y + " восток не совпал.";
        }
        if (y + 1 < h) {
          below = grid[y + 1][x];
          if (!labelsEqual(one.edges.S, below.edges.N)) return "Шов " + x + "," + y + " юг не совпал.";
        }
      }
    }
    return null;
  }

  function replaceError(grid, x, y, one) {
    var h = grid.length;
    var w = grid[0].length;
    if (x < 0 || y < 0 || x >= w || y >= h) return "Такой клетки нет.";
    var around = {
      N: [0, -1, "S", "сверху"],
      E: [1, 0, "W", "справа"],
      S: [0, 1, "N", "снизу"],
      W: [-1, 0, "E", "слева"]
    };
    var sideName = { N: "Северная", E: "Восточная", S: "Южная", W: "Западная" };
    var theirName = { N: "северная", E: "восточная", S: "южная", W: "западная" };
    var i, dir, info, nx, ny, neighbor;
    for (i = 0; i < DIRS.length; i++) {
      dir = DIRS[i];
      info = around[dir];
      nx = x + info[0];
      ny = y + info[1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      neighbor = grid[ny][nx];
      if (!labelsEqual(one.edges[dir], neighbor.edges[info[2]])) {
        return sideName[dir] + " сторона твоей плитки — " + labelText(one.edges[dir]) + ". У соседа " + info[3] + " " + theirName[info[2]] + " сторона — " + labelText(neighbor.edges[info[2]]) + ". По правилам плиток Вана так поставить нельзя.";
      }
    }
    return null;
  }

  function swapError(grid, x1, y1, x2, y2) {
    if (x1 === x2 && y1 === y2) return "Это та же самая клетка.";
    var copy = [];
    var y;
    for (y = 0; y < grid.length; y++) copy[y] = grid[y].slice();
    var first = grid[y1][x1];
    var second = grid[y2][x2];
    copy[y1][x1] = second;
    copy[y2][x2] = first;
    var error = replaceError(copy, x1, y1, second);
    if (error !== null) return error;
    return replaceError(copy, x2, y2, first);
  }

  function handCanPlaceAnywhere(grid, hand) {
    if (hand.length === 0 || grid.length === 0) return false;
    var h = grid.length;
    var w = grid[0].length;
    var i, y, x;
    for (i = 0; i < hand.length; i++) {
      for (y = 0; y < h; y++) {
        for (x = 0; x < w; x++) {
          if (replaceError(grid, x, y, hand[i]) === null) return true;
        }
      }
    }
    return false;
  }

  function smoothColors(colors, w, h) {
    var next = [];
    var y, x, dy, dx, ny, nx, votes, color, best, bestCount;
    for (y = 0; y < h; y++) {
      next[y] = [];
      for (x = 0; x < w; x++) {
        votes = [0, 0, 0];
        for (dy = -1; dy <= 1; dy++) {
          for (dx = -1; dx <= 1; dx++) {
            ny = y + dy;
            nx = x + dx;
            if (ny < 0 || nx < 0 || ny >= h || nx >= w) continue;
            votes[colors[ny][nx]] += 1;
          }
        }
        best = colors[y][x];
        bestCount = -1;
        for (color = 0; color <= 2; color++) {
          if (votes[color] > bestCount) {
            bestCount = votes[color];
            best = color;
          }
        }
        next[y][x] = best;
      }
    }
    return next;
  }

  function carvePond(hEdge, vEdge, w, h, used, rng) {
    var attempt, ww, hh, x0, y0, y, x, blocked;
    for (attempt = 0; attempt < 12; attempt++) {
      if (w < 2 || h < 2) return;
      ww = rng.int(2, Math.min(4, w));
      hh = rng.int(2, Math.min(3, h));
      x0 = rng.int(0, w - ww);
      y0 = rng.int(0, h - hh);
      blocked = false;
      for (y = y0; y < y0 + hh; y++) {
        for (x = x0; x < x0 + ww; x++) {
          if (hasKey(used, x + "," + y)) blocked = true;
        }
      }
      if (blocked) continue;
      for (y = y0; y < y0 + hh; y++) {
        for (x = x0; x < x0 + ww; x++) used[x + "," + y] = "water";
      }
      for (y = y0; y < y0 + hh; y++) {
        for (x = x0; x < x0 + ww - 1; x++) vEdge[y][x + 1] = "water";
      }
      for (y = y0; y < y0 + hh - 1; y++) {
        for (x = x0; x < x0 + ww; x++) hEdge[y + 1][x] = "water";
      }
      return;
    }
  }

  function markLink(hEdge, vEdge, x1, y1, x2, y2, label) {
    if (x1 === x2) {
      hEdge[Math.max(y1, y2)][x1] = label;
      return;
    }
    vEdge[y1][Math.max(x1, x2)] = label;
  }

  function stepPath(hEdge, vEdge, w, h, used, label, dirs, cursor, path, rng) {
    var order = dirs.slice();
    rng.shuffle(order);
    var i, nx, ny;
    for (i = 0; i < order.length; i++) {
      nx = cursor.x + order[i][0];
      ny = cursor.y + order[i][1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (hasKey(used, nx + "," + ny)) continue;
      markLink(hEdge, vEdge, cursor.x, cursor.y, nx, ny, label);
      used[nx + "," + ny] = label;
      cursor.x = nx;
      cursor.y = ny;
      path.push([cursor.x, cursor.y]);
      return true;
    }
    return false;
  }

  function carvePath(hEdge, vEdge, w, h, used, label, rng) {
    var free = [];
    var y, x, i;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        if (!hasKey(used, x + "," + y)) free.push([x, y]);
      }
    }
    if (free.length < 2) return;
    var start = free[rng.int(0, free.length - 1)];
    var cursor = { x: start[0], y: start[1] };
    used[cursor.x + "," + cursor.y] = label;
    var path = [[cursor.x, cursor.y]];
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    var target = Math.max(3, Math.floor((w + h) / 2));
    for (i = 0; i < target; i++) {
      if (!stepPath(hEdge, vEdge, w, h, used, label, dirs, cursor, path, rng)) break;
    }
    if (path.length >= 3) {
      var pivot = path[rng.int(1, path.length - 2)];
      cursor.x = pivot[0];
      cursor.y = pivot[1];
      var branch = rng.int(2, 3);
      for (i = 0; i < branch; i++) {
        if (!stepPath(hEdge, vEdge, w, h, used, label, dirs, cursor, path, rng)) break;
      }
    }
  }

  function generateSandbox(w, h, options, rng) {
    var useGrass = !!options.grass;
    var colors = [];
    var y, x, pass, color;
    for (y = 0; y < h; y++) {
      colors[y] = [];
      for (x = 0; x < w; x++) colors[y][x] = useGrass ? rng.int(0, 2) : 1;
    }
    if (useGrass) {
      for (pass = 0; pass < 2; pass++) colors = smoothColors(colors, w, h);
    }
    var hEdge = [];
    for (y = 0; y <= h; y++) {
      hEdge[y] = [];
      for (x = 0; x < w; x++) {
        if (y === 0) color = colors[0][x];
        else if (y === h) color = colors[h - 1][x];
        else color = colors[y - 1][x];
        hEdge[y][x] = "g" + color;
      }
    }
    var vEdge = [];
    for (y = 0; y < h; y++) {
      vEdge[y] = [];
      for (x = 0; x <= w; x++) {
        if (x === 0) color = colors[y][0];
        else if (x === w) color = colors[y][w - 1];
        else color = colors[y][x - 1];
        vEdge[y][x] = "g" + color;
      }
    }
    var used = {};
    if (options.water) carvePond(hEdge, vEdge, w, h, used, rng);
    if (options.river) carvePath(hEdge, vEdge, w, h, used, "river", rng);
    if (options.road) carvePath(hEdge, vEdge, w, h, used, "road", rng);
    var grid = [];
    var number = 1;
    for (y = 0; y < h; y++) {
      grid[y] = [];
      for (x = 0; x < w; x++) {
        grid[y][x] = tile("s" + number, {
          N: hEdge[y][x],
          E: vEdge[y][x + 1],
          S: hEdge[y + 1][x],
          W: vEdge[y][x]
        }, "terrain");
        number += 1;
      }
    }
    var error = seamError(grid);
    if (error !== null) throw new Error(error);
    return grid;
  }

  function showcaseTiles() {
    var tiles = [];
    var i;
    for (i = 0; i < SHOWCASE.length; i++) {
      tiles.push(tile("show" + (i + 1), {
        N: SHOWCASE[i][0],
        E: SHOWCASE[i][1],
        S: SHOWCASE[i][2],
        W: SHOWCASE[i][3]
      }, "terrain"));
    }
    return tiles;
  }

  function randomHand(count, rng) {
    var catalog = showcaseTiles();
    var hand = [];
    var i, source;
    for (i = 0; i < count; i++) {
      source = catalog[rng.int(0, catalog.length - 1)];
      hand.push(tile("hand" + rng.int(1000, 999999) + "n" + i, source.edges, "terrain"));
    }
    return hand;
  }

  function randomColorTiles(count, rng) {
    var palette = ["red", "blue", "yellow", "green", "orange"];
    var tiles = [];
    var i, uniqueCount, bag, colors, edgeColors;
    for (i = 0; i < count; i++) {
      uniqueCount = rng.int(2, 4);
      bag = palette.slice();
      rng.shuffle(bag);
      colors = bag.slice(0, uniqueCount);
      edgeColors = colors.slice();
      while (edgeColors.length < 4) {
        edgeColors.push(colors[rng.int(0, colors.length - 1)]);
      }
      rng.shuffle(edgeColors);
      tiles.push(tile("c" + (i + 1) + "x" + rng.int(100, 999), {
        N: edgeColors[0],
        E: edgeColors[1],
        S: edgeColors[2],
        W: edgeColors[3]
      }, "color"));
    }
    return tiles;
  }

  function byteHex(n) {
    var s = n.toString(16);
    if (s.length < 2) s = "0" + s;
    return s;
  }

  function fadeHex(n) {
    n = n | 0;
    if (n < 1) n = 1;
    if (n > 9) n = 9;
    var t = (n - 1) / 8;
    var r = Math.round(63 + (150 - 63) * t);
    var g = Math.round(158 + (92 - 158) * t);
    var b = Math.round(52 + (42 - 52) * t);
    return "#" + byteHex(r) + byteHex(g) + byteHex(b);
  }

  function svgWrap(inner) {
    return '<svg viewBox="0 0 100 100" class="tile-svg" aria-hidden="true">' + inner + '<rect x="2" y="2" width="96" height="96" fill="none" stroke="#2c241c" stroke-width="3" rx="8"/></svg>';
  }

  function svgColorTile(edges) {
    var hex = { red: "#e23d3d", blue: "#2f7dff", yellow: "#f2c14e", green: "#3aaa45", orange: "#ff7a32" };
    var inner = "";
    var i, dir, name;
    for (i = 0; i < DIRS.length; i++) {
      dir = DIRS[i];
      name = edges[dir];
      inner += '<polygon points="' + WEDGES[dir] + '" fill="' + (hex[name] || "#cccccc") + '"/>';
    }
    inner += '<circle cx="50" cy="50" r="9" fill="#fffdf8" stroke="#2c241c" stroke-width="2"/>';
    return svgWrap(inner);
  }

  function svgRoadTile(edges) {
    var lines = { N: "50,50 50,4", E: "50,50 96,50", S: "50,50 50,96", W: "50,50 4,50" };
    var marks = { N: [50, 16], E: [82, 54], S: [50, 90], W: [18, 54] };
    var inner = '<rect x="2" y="2" width="96" height="96" rx="8" fill="#f0d7a2"/>';
    var i, dir, value, point;
    for (i = 0; i < DIRS.length; i++) {
      dir = DIRS[i];
      value = edges[dir] | 0;
      if (value !== 1) continue;
      inner += '<polyline points="' + lines[dir] + '" fill="none" stroke="#5c6570" stroke-width="16" stroke-linecap="square"/>';
      inner += '<polyline points="' + lines[dir] + '" fill="none" stroke="#f7fbff" stroke-width="2" stroke-dasharray="4 4"/>';
    }
    for (i = 0; i < DIRS.length; i++) {
      dir = DIRS[i];
      value = edges[dir] | 0;
      point = marks[dir];
      inner += '<circle cx="' + point[0] + '" cy="' + point[1] + '" r="8" fill="#fffdf8" stroke="#2c241c" stroke-width="1"/>';
      inner += '<text x="' + point[0] + '" y="' + (point[1] + 4) + '" text-anchor="middle" font-size="12" font-family="' + FONT + '" fill="#2c241c">' + value + "</text>";
    }
    return svgWrap(inner);
  }

  function grassUid() {
    grassSerial += 1;
    return "gw" + grassSerial;
  }

  function grassPhotoDefs(uid) {
    var defs = "<defs>";
    var i, dir;
    for (i = 0; i < DIRS.length; i++) {
      dir = DIRS[i];
      defs += '<clipPath id="' + uid + "k" + dir + '"><polygon points="' + WEDGES[dir] + '"/></clipPath>';
    }
    for (i = 0; i < GRASS_MATRICES.length; i++) {
      defs += '<filter id="' + uid + "c" + i + '" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="' + GRASS_MATRICES[i] + '"/></filter>';
    }
    defs += "</defs>";
    return defs;
  }

  function grassWedge(uid, dir, height, color) {
    height = height | 0;
    color = color | 0;
    if (height < 0 || height > 3) height = 0;
    if (color < 0 || color > 3) color = 0;
    return '<image href="assets/img/grass/h' + height + '.png" x="0" y="0" width="100" height="100" preserveAspectRatio="none" clip-path="url(#' + uid + "k" + dir + ')" filter="url(#' + uid + "c" + color + ')"/>';
  }

  function svgFadeTile(edges) {
    var n = fadeNumber(edges.N);
    if (n === null) n = 1;
    var inner = '<rect x="2" y="2" width="96" height="96" rx="8" fill="' + fadeHex(n) + '"/>';
    inner += '<text x="50" y="64" text-anchor="middle" font-size="42" font-family="' + FONT + '" fill="#fffdf8" stroke="#2c241c" stroke-width="6">' + n + "</text>";
    inner += '<text x="50" y="64" text-anchor="middle" font-size="42" font-family="' + FONT + '" fill="#2c241c">' + n + "</text>";
    return svgWrap(inner);
  }

  function svgGrassTile(edges) {
    var uid = grassUid();
    var inner = grassPhotoDefs(uid);
    var i, dir;
    for (i = 0; i < DIRS.length; i++) {
      dir = DIRS[i];
      inner += grassWedge(uid, dir, edges[dir] && edges[dir].height, edges[dir] && edges[dir].color);
    }
    return svgWrap(inner);
  }

  function svgTerrainTile(edges) {
    var grassColor = { g0: 0, g1: 1, g2: 2 };
    var lines = { N: "50,50 50,3", E: "50,50 97,50", S: "50,50 50,97", W: "50,50 3,50" };
    var uid = grassUid();
    var inner = "";
    var waterCount = 0;
    var needsGrass = false;
    var i, dir, label, fill;
    for (i = 0; i < DIRS.length; i++) {
      dir = DIRS[i];
      label = edges[dir];
      if (hasKey(grassColor, label)) {
        needsGrass = true;
        inner += grassWedge(uid, dir, 1, grassColor[label]);
        continue;
      }
      if (label === "water" || label === "river") {
        fill = "#3aa0e0";
        if (label === "water") waterCount += 1;
      } else if (label === "road") {
        fill = "#d2c09a";
      } else {
        fill = "#d8c09a";
      }
      inner += '<polygon points="' + WEDGES[dir] + '" fill="' + fill + '"/>';
    }
    if (needsGrass) inner = grassPhotoDefs(uid) + inner;
    for (i = 0; i < DIRS.length; i++) {
      dir = DIRS[i];
      if (edges[dir] === "road") {
        inner += '<polyline points="' + lines[dir] + '" fill="none" stroke="#5c6570" stroke-width="14" stroke-linecap="square"/>';
        inner += '<polyline points="' + lines[dir] + '" fill="none" stroke="#f7fbff" stroke-width="2" stroke-dasharray="4 4"/>';
      }
      if (edges[dir] === "river") {
        inner += '<polyline points="' + lines[dir] + '" fill="none" stroke="#1f6fba" stroke-width="12" stroke-linecap="round"/>';
        inner += '<polyline points="' + lines[dir] + '" fill="none" stroke="#d7f1ff" stroke-width="2"/>';
      }
    }
    if (waterCount === 4) {
      inner += '<path d="M14,40 Q28,32 42,40 T70,40 T90,40" fill="none" stroke="#e9f7ff" stroke-width="3"/>';
      inner += '<path d="M14,58 Q28,50 42,58 T70,58 T90,58" fill="none" stroke="#e9f7ff" stroke-width="3"/>';
    }
    return svgWrap(inner);
  }

  function renderTileSvg(one) {
    if (one.kind === "color") return svgColorTile(one.edges);
    if (one.kind === "road") return svgRoadTile(one.edges);
    if (one.kind === "grass") return svgGrassTile(one.edges);
    if (one.kind === "fade") return svgFadeTile(one.edges);
    return svgTerrainTile(one.edges);
  }

  function esc(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function toInt(value, fallback) {
    if (value === null || value === undefined || value === "") return fallback;
    var n = parseInt(value, 10);
    if (isNaN(n)) return fallback;
    return n;
  }

  function blankState() {
    return {
      flash: { 1: "", 2: "", 3: "", 4: "" },
      flashKind: { 1: "info", 2: "info", 3: "info", 4: "info" },
      l1: null,
      l2: null,
      l3: null,
      l4: null
    };
  }

  function flash(state, level, text, kind) {
    state.flash[level] = text;
    state.flashKind[level] = kind;
  }

  function findTray(tray, id) {
    var i;
    for (i = 0; i < tray.length; i++) {
      if (tray[i].id === id) return i;
    }
    return null;
  }

  function level1Deadlock(board, tray) {
    if (tray.length === 0) return "";
    if (hasLegalPlacement(board, tray)) return "";
    return " Ни одна плитка из панели уже никуда не встаёт. Возьми новые плитки или сбрось сборку.";
  }

  function dealLevel1(state) {
    var rng = mathRng();
    var count = rng.int(8, 10);
    state.l1 = {
      tray: randomColorTiles(count, rng),
      board: {},
      selected: null
    };
    flash(state, 1, "Внизу " + count + " плиток. Выбери любую — она встанет в центр.", "info");
  }

  function actLevel1(state, action, post) {
    if (action === "deal" || !state.l1) {
      dealLevel1(state);
      return;
    }
    var level = state.l1;
    if (action === "reset") {
      var keys = Object.keys(level.board);
      var i;
      for (i = 0; i < keys.length; i++) level.tray.push(level.board[keys[i]]);
      level.board = {};
      level.selected = null;
      flash(state, 1, "Сборка сброшена. Плитки снова внизу. Первая выбранная встанет в центр.", "info");
      return;
    }
    if (action === "pick") {
      var id = post.id ? String(post.id) : "";
      var index = findTray(level.tray, id);
      if (index === null) {
        flash(state, 1, "Эта плитка уже не в панели.", "bad");
        return;
      }
      if (Object.keys(level.board).length === 0) {
        var first = level.tray[index];
        level.tray.splice(index, 1);
        level.board["0,0"] = first;
        level.selected = null;
        var note = "Плитка в центре. Теперь выбери следующую и пустую клетку рядом.";
        note += level1Deadlock(level.board, level.tray);
        flash(state, 1, note, note.indexOf("никуда не встаёт") !== -1 ? "bad" : "good");
        return;
      }
      level.selected = id;
      flash(state, 1, "Плитка выбрана. Нажми на пустую клетку рядом с собранными.", "info");
      return;
    }
    if (action === "place") {
      var selected = level.selected;
      if (selected === null || selected === "") {
        flash(state, 1, "Сначала выбери плитку внизу.", "info");
        return;
      }
      var at = findTray(level.tray, selected);
      if (at === null) {
        level.selected = null;
        flash(state, 1, "Эта плитка уже не в панели.", "bad");
        return;
      }
      var x = toInt(post.x, 0);
      var y = toInt(post.y, 0);
      var error = placementError(level.board, x, y, level.tray[at]);
      if (error !== null) {
        error += level1Deadlock(level.board, level.tray);
        flash(state, 1, error, "bad");
        return;
      }
      var saved = level.tray[at];
      level.tray.splice(at, 1);
      level.board[x + "," + y] = saved;
      level.selected = null;
      if (level.tray.length === 0) {
        flash(state, 1, "Все плитки стоят по правилам Вана. Красиво вышло.", "good");
        return;
      }
      var extra = level1Deadlock(level.board, level.tray);
      if (extra !== "") {
        flash(state, 1, "Плитка встала." + extra, "bad");
        return;
      }
      flash(state, 1, "Плитка встала. Стороны совпали.", "good");
    }
  }

  function newLevel2(state, full) {
    var w = 6;
    var h = 5;
    var edges = blankEdges(w, h);
    var placed = {};
    var explain = "Нажми «Следующая плитка», чтобы алгоритм поставил одну, или «Собрать всю карту».";
    var mode = "step";
    if (full) {
      fillAll(edges.hEdge, edges.vEdge, placed, w, h, "road", mathRng());
      explain = "Карта готова. Зелёная галочка стоит на каждом шве: стороны совпали. Тупиков здесь не бывает — алгоритм выбирает только подходящие плитки.";
      mode = "full";
    }
    state.l2 = {
      w: w,
      h: h,
      hEdge: edges.hEdge,
      vEdge: edges.vEdge,
      placed: placed,
      mode: mode,
      explain: explain
    };
    flash(state, 2, explain, "info");
  }

  function actLevel2(state, action) {
    if (action === "full" || !state.l2) {
      newLevel2(state, true);
      if (action !== "step_start") return;
    }
    if (action === "step_start") {
      newLevel2(state, false);
      actLevel2(state, "step_next");
      return;
    }
    var level = state.l2;
    if (action === "step_next" || action === "finish") {
      var rng = mathRng();
      var guard = 0;
      var limit = action === "finish" ? level.w * level.h : 1;
      var explain = level.explain;
      var step;
      while (guard < limit) {
        step = placeNext(level.hEdge, level.vEdge, level.placed, level.w, level.h, "road", rng);
        explain = step.explain;
        guard += 1;
        if (step.done) break;
        if (action === "step_next") break;
      }
      var done = Object.keys(level.placed).length >= level.w * level.h;
      level.mode = done ? "full" : "step";
      level.explain = explain;
      flash(state, 2, explain, "info");
    }
  }

  function fadeTray(board, count, rng) {
    var slots = openSlots(board);
    var slotKeys = Object.keys(slots);
    var slotList = [];
    var s;
    for (s = 0; s < slotKeys.length; s++) slotList.push(slots[slotKeys[s]]);
    var tray = [];
    var i, color, order, allowed;
    for (i = 0; i < count; i++) {
      color = rng.int(1, 9);
      order = slotList.slice();
      rng.shuffle(order);
      for (s = 0; s < order.length; s++) {
        allowed = fadeChoices(board, order[s][0], order[s][1]);
        if (allowed.length > 0) {
          color = allowed[rng.int(0, allowed.length - 1)];
          break;
        }
      }
      tray.push(fadeTile("t" + i + "r" + rng.int(10000, 99999), color));
    }
    return tray;
  }

  function level3Deadlock(board, tray) {
    if (tray.length === 0) return "";
    if (hasLegalPlacement(board, tray)) return "";
    return " Ни одна плитка из панели уже никуда не встаёт. Возьми новые плитки или другую карту.";
  }

  function newLevel3(state) {
    var rng = mathRng();
    var board = generateFade(4, 4, rng);
    state.l3 = {
      board: board,
      tray: fadeTray(board, 8, rng),
      selected: null
    };
    flash(state, 3, "Карта 4×4 собрана. Рядом встают одинаковые цвета и соседние номера. Выбери плитку внизу и поставь её в пунктирную клетку.", "info");
  }

  function actLevel3(state, action, post) {
    if (action === "regen" || !state.l3 || !state.l3.board) {
      newLevel3(state);
      return;
    }
    var level = state.l3;
    if (action === "deal") {
      var added = fadeTray(level.board, 8, mathRng());
      var i;
      for (i = 0; i < added.length; i++) level.tray.push(added[i]);
      flash(state, 3, "Добавлено 8 плиток. Прежние остались внизу, можно играть дальше.", "info");
      return;
    }
    if (action === "pick") {
      var id = post.id ? String(post.id) : "";
      if (findTray(level.tray, id) === null) {
        flash(state, 3, "Эта плитка уже не в панели.", "bad");
        return;
      }
      level.selected = id;
      flash(state, 3, "Плитка выбрана. Нажми на пустую клетку рядом с полем.", "info");
      return;
    }
    if (action === "place") {
      var selected = level.selected;
      if (selected === null || selected === "") {
        flash(state, 3, "Сначала выбери плитку внизу.", "info");
        return;
      }
      var at = findTray(level.tray, selected);
      if (at === null) {
        level.selected = null;
        flash(state, 3, "Эта плитка уже не в панели.", "bad");
        return;
      }
      var x = toInt(post.x, 0);
      var y = toInt(post.y, 0);
      var error = placementError(level.board, x, y, level.tray[at]);
      if (error !== null) {
        error += level3Deadlock(level.board, level.tray);
        flash(state, 3, error, "bad");
        return;
      }
      var saved = level.tray[at];
      level.tray.splice(at, 1);
      level.board[x + "," + y] = saved;
      level.selected = null;
      var extra = level3Deadlock(level.board, level.tray);
      if (extra !== "") {
        flash(state, 3, "Плитка встала." + extra, "bad");
        return;
      }
      if (level.tray.length === 0) {
        flash(state, 3, "Все плитки из панели стоят на поле. Цвета стыкуются.", "good");
        return;
      }
      flash(state, 3, "Плитка встала. Цвета стыкуются.", "good");
    }
  }

  function level4Status(state, prefix) {
    var level = state.l4;
    if (!level || !handCanPlaceAnywhere(level.grid, level.hand)) {
      flash(state, 4, prefix + " Ни одна плитка снизу сейчас не встаёт на карту. Пересдай плитки или поменяй клетки на поле местами.", "bad");
      return;
    }
    flash(state, 4, prefix, "info");
  }

  function newLevel4(state, w, h, seed, grass, water, river, road, prefix) {
    var rng = seededRng(seed);
    var grid;
    try {
      grid = generateSandbox(w, h, { grass: grass, water: water, river: river, road: road }, rng);
    } catch (error) {
      flash(state, 4, "Карта не собралась. Нажми «Собрать карту» ещё раз.", "bad");
      return;
    }
    state.l4 = {
      w: w,
      h: h,
      seed: seed,
      grass: grass,
      water: water,
      river: river,
      road: road,
      grid: grid,
      hand: randomHand(6, rng),
      selHand: null,
      selCell: null
    };
    level4Status(state, prefix + "Карта собрана по правилам. Выбери плитку снизу и клетку или две клетки на поле.");
  }

  function level4Replace(state, index, key) {
    var level = state.l4;
    var parts = String(key).split(",");
    var x = parseInt(parts[0], 10);
    var y = parseInt(parts[1], 10);
    if (!level.hand[index] || !level.grid[y] || !level.grid[y][x]) {
      flash(state, 4, "Так выбрать не получилось.", "bad");
      return;
    }
    var error = replaceError(level.grid, x, y, level.hand[index]);
    if (error !== null) {
      if (!handCanPlaceAnywhere(level.grid, level.hand)) {
        error += " Ни одна плитка снизу сейчас не встаёт на карту.";
      }
      flash(state, 4, error, "bad");
      return;
    }
    var old = level.grid[y][x];
    level.grid[y][x] = level.hand[index];
    level.hand[index] = old;
    level.selHand = null;
    level.selCell = null;
    level4Status(state, "Плитка встала. Старая клетка ушла вниз, в твои плитки.");
  }

  function level4Swap(state, from, to) {
    var level = state.l4;
    var a = String(from).split(",");
    var b = String(to).split(",");
    var x1 = parseInt(a[0], 10);
    var y1 = parseInt(a[1], 10);
    var x2 = parseInt(b[0], 10);
    var y2 = parseInt(b[1], 10);
    if (!level.grid[y1] || !level.grid[y1][x1] || !level.grid[y2] || !level.grid[y2][x2]) {
      flash(state, 4, "Так выбрать не получилось.", "bad");
      return;
    }
    var error = swapError(level.grid, x1, y1, x2, y2);
    if (error !== null) {
      level.selCell = null;
      flash(state, 4, error, "bad");
      return;
    }
    var first = level.grid[y1][x1];
    level.grid[y1][x1] = level.grid[y2][x2];
    level.grid[y2][x2] = first;
    level.selCell = null;
    level.selHand = null;
    flash(state, 4, "Клетки поменялись местами, стороны по-прежнему совпадают.", "good");
  }

  function actLevel4(state, action, post) {
    if (action === "generate" || !state.l4) {
      var w = toInt(post.w, 8);
      var h = toInt(post.h, 6);
      if (w < 5) w = 5;
      if (w > 10) w = 10;
      if (h < 4) h = 4;
      if (h > 8) h = 8;
      var grass = !!post.grass;
      var water = !!post.water;
      var river = !!post.river;
      var road = !!post.road;
      var prefix = "";
      if (!grass && !water && !river && !road) {
        grass = true;
        prefix = "Все галочки были сняты, поэтому оставлена ровная трава. ";
      }
      var seed = toInt(post.seed, 0);
      if (seed <= 0) seed = 1 + Math.floor(Math.random() * 999999);
      newLevel4(state, w, h, seed, grass, water, river, road, prefix);
      return;
    }
    var level = state.l4;
    if (action === "reroll") {
      level.hand = randomHand(6, mathRng());
      level.selHand = null;
      level.selCell = null;
      level4Status(state, "Новые плитки внизу.");
      return;
    }
    if (action === "hand") {
      var index = toInt(post.idx, -1);
      if (!level.hand[index]) return;
      if (level.selCell != null) {
        level4Replace(state, index, level.selCell);
        return;
      }
      if (level.selHand === index) {
        level.selHand = null;
        flash(state, 4, "Выбор снят.", "info");
        return;
      }
      level.selHand = index;
      flash(state, 4, "Плитка выбрана. Нажми клетку на карте.", "info");
      return;
    }
    if (action === "cell") {
      var x = toInt(post.x, 0);
      var y = toInt(post.y, 0);
      var key = x + "," + y;
      if (level.selHand != null) {
        level4Replace(state, level.selHand, key);
        return;
      }
      if (level.selCell != null) {
        if (level.selCell === key) {
          level.selCell = null;
          flash(state, 4, "Выбор снят.", "info");
          return;
        }
        level4Swap(state, level.selCell, key);
        return;
      }
      level.selCell = key;
      flash(state, 4, "Клетка выбрана. Нажми другую клетку, чтобы поменять их местами, или плитку снизу, чтобы заменить выбранную.", "info");
    }
  }

  function actOn(state, level, action, post) {
    if (level === 1) actLevel1(state, action, post);
    else if (level === 2) actLevel2(state, action, post);
    else if (level === 3) actLevel3(state, action, post);
    else actLevel4(state, action, post);
  }

  function ensure(state) {
    var n;
    if (!state.flash) state.flash = {};
    if (!state.flashKind) state.flashKind = {};
    for (n = 1; n <= 4; n++) {
      if (state.flash[n] === undefined) state.flash[n] = "";
      if (!state.flashKind[n]) state.flashKind[n] = "info";
    }
    if (!state.l1) dealLevel1(state);
    if (!state.l2) newLevel2(state, true);
    if (!state.l3 || !state.l3.board) newLevel3(state);
    if (!state.l4) {
      var attempt, seed;
      for (attempt = 0; attempt < 8 && !state.l4; attempt++) {
        seed = 1 + Math.floor(Math.random() * 999999);
        newLevel4(state, 8, 6, seed, true, true, true, true, "");
      }
    }
  }

  function boundsOf(board) {
    var slots = openSlots(board);
    var keys = Object.keys(board);
    var minX = 0;
    var maxX = 0;
    var minY = 0;
    var maxY = 0;
    var seen = false;
    var i, parts, x, y, slotKeys;
    function take(px, py) {
      if (!seen) {
        minX = maxX = px;
        minY = maxY = py;
        seen = true;
        return;
      }
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
    for (i = 0; i < keys.length; i++) {
      parts = keys[i].split(",");
      take(parseInt(parts[0], 10), parseInt(parts[1], 10));
    }
    slotKeys = Object.keys(slots);
    for (i = 0; i < slotKeys.length; i++) take(slots[slotKeys[i]][0], slots[slotKeys[i]][1]);
    return {
      minX: minX,
      maxX: maxX,
      minY: minY,
      maxY: maxY,
      seen: seen,
      slots: slots,
      cols: seen ? maxX - minX + 1 : 1
    };
  }

  function banner(state, level) {
    var text = state.flash[level] || "";
    if (!text) return "";
    var kind = state.flashKind[level] || "info";
    return '<p class="banner ' + kind + '" role="status">' + esc(text) + "</p>";
  }

  function tileFace(one, button, attrs, selected) {
    var tag = button ? "button" : "div";
    var type = button ? ' type="button"' : "";
    var role = button ? "" : ' role="img"';
    var cls = "tile-btn" + (selected ? " is-selected" : "");
    return "<" + tag + ' class="' + cls + '"' + type + role + attrs + ' aria-label="' + esc(tileLabel(one)) + '">' + renderTileSvg(one) + "</" + tag + ">";
  }

  function assemblyGrid(board, levelNum) {
    var box = boundsOf(board);
    var html = '<div class="map-scroll"><div class="tile-grid" style="--cols: ' + box.cols + '">';
    if (!box.seen) {
      html += '<div class="slot slot-wait">Центр</div>';
    } else {
      var y, x, key;
      for (y = box.minY; y <= box.maxY; y++) {
        for (x = box.minX; x <= box.maxX; x++) {
          key = x + "," + y;
          html += '<div class="cell">';
          if (hasKey(board, key)) {
            html += tileFace(board[key], false, "", false);
          } else if (hasKey(box.slots, key)) {
            html += '<button class="slot" type="button" data-act="place" data-level="' + levelNum + '" data-x="' + x + '" data-y="' + y + '" aria-label="Поставить выбранную плитку в эту клетку"></button>';
          } else {
            html += '<div class="slot" style="visibility: hidden"></div>';
          }
          html += "</div>";
        }
      }
    }
    html += "</div></div>";
    return html;
  }

  function trayHtml(tray, selected, actName) {
    var html = '<section class="tray"><h2>Твои плитки: ' + tray.length + '</h2><div class="tray-scroll">';
    var i, one;
    for (i = 0; i < tray.length; i++) {
      one = tray[i];
      html += "<form>" + tileFace(one, true, ' data-act="' + actName + '" data-id="' + esc(one.id) + '"', selected === one.id) + "</form>";
    }
    html += "</div></section>";
    return html;
  }

  function renderLevel1(state) {
    var pack = state.l1;
    var html = '<div class="row-actions">';
    html += '<button class="btn" type="button" data-act="deal">Новые плитки</button>';
    html += '<button class="btn quiet" type="button" data-act="reset">Сбросить сборку</button>';
    html += "</div>";
    html += assemblyGrid(pack.board, 1);
    html += trayHtml(pack.tray, pack.selected, "pick");
    return html;
  }

  function renderLevel2(state) {
    var pack = state.l2;
    var total = pack.w * pack.h;
    var count = Object.keys(pack.placed).length;
    var done = count >= total;
    var html = '<div class="row-actions">';
    html += '<button class="btn" type="button" data-act="full">Новая карта</button>';
    if (done) {
      html += '<button class="btn blue" type="button" data-act="step_start">Смотреть по шагам</button>';
    } else {
      html += '<button class="btn blue" type="button" data-act="step_next">Следующая плитка</button>';
      html += '<button class="btn quiet" type="button" data-act="finish">Дособрать сразу</button>';
    }
    html += "</div>";
    html += "<p>Поставлено " + count + " из " + total + ".</p>";
    html += '<div class="map-scroll"><div class="tile-grid with-checks" style="--cols: ' + pack.w + '">';
    var y, x, key, east, south;
    for (y = 0; y < pack.h; y++) {
      for (x = 0; x < pack.w; x++) {
        key = x + "," + y;
        east = (x + 1) + "," + y;
        south = x + "," + (y + 1);
        html += '<div class="cell">';
        if (hasKey(pack.placed, key)) {
          html += tileFace(pack.placed[key], false, "", false);
          if (hasKey(pack.placed, east)) html += '<span class="check check-e" aria-label="Стороны совпали">✓</span>';
          if (hasKey(pack.placed, south)) html += '<span class="check check-s" aria-label="Стороны совпали">✓</span>';
        } else {
          html += '<div class="slot" aria-hidden="true"></div>';
        }
        html += "</div>";
      }
    }
    html += "</div></div>";
    return html;
  }

  function renderLevel3(state) {
    var pack = state.l3;
    var html = "<p>Девять цветов идут от зелёного к коричневому. Рядом встают одинаковые цвета и соседние номера: цвет 1 к цветам 1 и 2, цвет 4 к цветам 3, 4 и 5, цвет 9 к цветам 8 и 9. Окно 4×4 уже собрано. Выбери плитку внизу и поставь её в пунктирную клетку рядом. «Новые плитки» добавляет ещё плиток и не убирает старые.</p>";
    html += "<p>";
    var c;
    for (c = 1; c <= 9; c++) {
      html += '<i class="swatch" style="background: ' + fadeHex(c) + '"></i> ' + c + " ";
    }
    html += "</p>";
    html += '<div class="row-actions">';
    html += '<button class="btn" type="button" data-act="deal">Новые плитки</button>';
    html += '<button class="btn quiet" type="button" data-act="regen">Другая карта</button>';
    html += "</div>";
    html += assemblyGrid(pack.board, 3);
    html += trayHtml(pack.tray, pack.selected, "pick");
    return html;
  }

  function renderLevel4(state) {
    var pack = state.l4;
    if (!pack) {
      return '<form class="settings" data-act="generate"><h2>Настройки</h2><button class="btn" type="submit">Собрать карту</button></form>';
    }
    var html = '<div class="sandbox"><div class="map-scroll sandbox-map"><div class="tile-grid" style="--cols: ' + pack.w + '">';
    var y, x, key, one;
    for (y = 0; y < pack.h; y++) {
      for (x = 0; x < pack.w; x++) {
        key = x + "," + y;
        one = pack.grid[y][x];
        html += '<div class="cell' + (pack.selCell === key ? " is-selected" : "") + '">';
        html += tileFace(one, true, ' data-act="cell" data-x="' + x + '" data-y="' + y + '"', false);
        html += "</div>";
      }
    }
    html += '</div></div><form class="settings" data-act="generate"><h2>Настройки</h2>';
    html += "<label>Ширина <select name=\"w\">";
    var n;
    for (n = 5; n <= 10; n++) html += '<option value="' + n + '"' + (pack.w === n ? " selected" : "") + ">" + n + "</option>";
    html += "</select></label>";
    html += "<label>Высота <select name=\"h\">";
    for (n = 4; n <= 8; n++) html += '<option value="' + n + '"' + (pack.h === n ? " selected" : "") + ">" + n + "</option>";
    html += "</select></label>";
    html += '<label><input type="checkbox" name="grass" value="1"' + (pack.grass ? " checked" : "") + "> Трава</label>";
    html += '<label><input type="checkbox" name="water" value="1"' + (pack.water ? " checked" : "") + "> Вода</label>";
    html += '<label><input type="checkbox" name="river" value="1"' + (pack.river ? " checked" : "") + "> Река</label>";
    html += '<label><input type="checkbox" name="road" value="1"' + (pack.road ? " checked" : "") + "> Дорога</label>";
    html += '<label>Зерно карты <input type="number" name="seed" value="' + pack.seed + '"></label>';
    html += '<button class="btn" type="submit">Собрать карту</button></form>';
    html += '<section class="tray"><h2>Твои плитки</h2><div class="row-actions">';
    html += '<button class="btn quiet" type="button" data-act="reroll">Новые плитки</button></div><div class="tray-scroll">';
    for (n = 0; n < pack.hand.length; n++) {
      html += "<form>" + tileFace(pack.hand[n], true, ' data-act="hand" data-idx="' + n + '"', pack.selHand === n) + "</form>";
    }
    html += "</div></section></div>";
    return html;
  }

  function lessonColor() {
    return '<details class="lesson" open><summary>Как собирать</summary>' +
      "<p>Плитка Вана — отдельная карточка. У неё покрашены стороны, и крутить её нельзя: верх остаётся верхом. Две плитки соединяются, только если соприкасающиеся стороны одного цвета.</p>" +
      "<p>Сначала выбери любую плитку внизу — она встанет в центр. Потом выбери другую и нажми пунктирную клетку рядом. Если цвет не совпал, плитка вернётся вниз и напишет, какие стороны спорят.</p>" +
      '<p><i class="swatch red"></i> красный <i class="swatch blue"></i> синий <i class="swatch yellow"></i> жёлтый <i class="swatch green"></i> зелёный <i class="swatch orange"></i> оранжевый</p>' +
      "</details>";
  }

  function lessonRoad() {
    return '<details class="lesson" open><summary>Как читаются дороги</summary>' +
      "<p>Теперь на стороне не цвет, а число. 0 — дороги нет, 1 — дорога есть. Алгоритм тот же: на общем ребре у обеих плиток должно стоять одно и то же число. Зелёная галочка показывает, что правило выполнено.</p>" +
      "<p>Карта собирается сама. Можно смотреть её сразу или по одной плитке. Сюда нельзя поставить плитку руками, поэтому тупика не бывает.</p>" +
      "</details>";
  }

  function lessonSandbox() {
    return '<details class="lesson"><summary>Как устроена песочница</summary>' +
      "<p>Закон сторон тот же, только вместо цвета на ребре стоит местность: трава, вода, река или дорога. Генератор сам собирает карту. Снизу лежат твои плитки.</p>" +
      "<p>Выбери плитку и клетку, чтобы заменить. Или выбери две клетки, чтобы поменять их местами. Если ход ломает правило, плитка не встанет и появится объяснение. Плитки по-прежнему не крутятся.</p>" +
      "</details>";
  }

  function renderStage(state, level) {
    grassSerial = 0;
    var html = "";
    if (level === 1) html += lessonColor();
    else if (level === 2) html += lessonRoad();
    else if (level === 4) html += lessonSandbox();
    html += banner(state, level);
    if (level === 1 && state.l1) html += renderLevel1(state);
    else if (level === 2 && state.l2) html += renderLevel2(state);
    else if (level === 3 && state.l3) html += renderLevel3(state);
    else if (level === 4) html += renderLevel4(state);
    return html;
  }

  function renderNav(level) {
    var names = { 1: "Сборка", 2: "Дороги", 3: "Трава", 4: "Песочница" };
    var html = "";
    var i;
    for (i = 1; i <= 4; i++) {
      html += '<a class="' + (i === level ? "is-on" : "") + '" href="tiles.html?level=' + i + '">' + i + ". " + names[i] + "</a>";
    }
    return html;
  }

  function currentLevel() {
    var level = 1;
    try {
      level = parseInt(new URLSearchParams(window.location.search).get("level"), 10);
    } catch (error) {
      level = 1;
    }
    if (isNaN(level) || level < 1 || level > 4) level = 1;
    return level;
  }

  function fillRoads(seed) {
    var rng = seededRng(seed || 1);
    var w = 6;
    var h = 5;
    var edges = blankEdges(w, h);
    var placed = {};
    var explain = fillAll(edges.hEdge, edges.vEdge, placed, w, h, "road", rng);
    return {
      explain: explain,
      placed: placed,
      w: w,
      h: h,
      seam: seamError(gridFromPlaced(placed, w, h)),
      count: Object.keys(placed).length
    };
  }

  var state = null;

  function persist() {
    if (typeof localStorage === "undefined" || !state) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {}
  }

  function loadState() {
    if (typeof localStorage === "undefined") return null;
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || typeof data !== "object") return null;
      return data;
    } catch (error) {
      return null;
    }
  }

  function draw() {
    var level = currentLevel();
    var names = { 1: "Сборка", 2: "Дороги", 3: "Трава", 4: "Песочница" };
    var title = document.getElementById("tile-title");
    if (title) title.textContent = names[level];
    var nav = document.getElementById("level-nav");
    if (nav) nav.innerHTML = renderNav(level);
    var stage = document.getElementById("tile-stage");
    if (stage) stage.innerHTML = renderStage(state, level);
  }

  function boot() {
    var stage = document.getElementById("tile-stage");
    if (!stage) return;
    try {
      state = loadState() || blankState();
      ensure(state);
    } catch (error) {
      state = blankState();
      ensure(state);
    }
    stage.addEventListener("click", function (event) {
      var button = event.target.closest ? event.target.closest("button[data-act]") : null;
      if (!button || !stage.contains(button)) return;
      event.preventDefault();
      actOn(state, currentLevel(), button.getAttribute("data-act"), {
        id: button.getAttribute("data-id") || "",
        x: button.getAttribute("data-x"),
        y: button.getAttribute("data-y"),
        idx: button.getAttribute("data-idx")
      });
      persist();
      draw();
    });
    stage.addEventListener("submit", function (event) {
      event.preventDefault();
      var form = event.target;
      if (!form || form.getAttribute("data-act") !== "generate") return;
      var data = new FormData(form);
      actOn(state, 4, "generate", {
        w: data.get("w"),
        h: data.get("h"),
        grass: data.get("grass") !== null,
        water: data.get("water") !== null,
        river: data.get("river") !== null,
        road: data.get("road") !== null,
        seed: data.get("seed")
      });
      persist();
      draw();
    });
    persist();
    draw();
  }

  root.WangTiles = {
    blank: blankState,
    fresh: function () {
      var next = blankState();
      ensure(next);
      return next;
    },
    act: function (next, level, action, post) {
      actOn(next, level, action, post || {});
      return next;
    },
    fadePartners: fadePartners,
    fadeNumber: fadeNumber,
    fadeTile: fadeTile,
    tile: tile,
    placementError: placementError,
    replaceError: replaceError,
    swapError: swapError,
    seamError: seamError,
    generateFade: function (w, h, seed) {
      return generateFade(w, h, seededRng(seed || 1));
    },
    fillRoads: fillRoads,
    generateSandbox: function (w, h, options, seed) {
      return generateSandbox(w, h, options, seededRng(seed || 1));
    },
    gridFromPlaced: gridFromPlaced,
    renderStage: renderStage,
    renderTile: renderTileSvg,
    labelText: labelText,
    fadeHex: fadeHex
  };

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }
})(typeof window !== "undefined" ? window : globalThis);
