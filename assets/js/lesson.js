/*
 * Учебные пометки к ходам Rogue.
 *
 * Чтобы прокомментировать действие игрока, допиши строку в объект notes
 * внутри commentOnAction.
 * Ключ — имя действия, значение — текст для панели «Заметка к ходу».
 * В тексте можно писать {name}: подставится имя монстра или предмета.
 * Если действия нет в списке, панель для этого хода остаётся без новой фразы.
 *
 * Имена действий:
 * move, wall, wait, fight_hit, fight_miss, monster_hit, kill,
 * pickup_gold, pickup_potion, pickup_food, pickup_weapon, pickup_armor, pickup_amulet,
 * stairs_down, stairs_up, stairs_blocked, win, dead, eat, drink, hungry, very_hungry
 */

(function (root) {
  var notes = {
    move: "Шаг на свободную клетку. В Rogue после тебя ходят монстры.",
    wall: "Стена занимает клетку, сквозь неё не пройти. Ход из-за этого не тратится.",
    wait: "Ожидание — тоже ход. Монстры за это время успевают сдвинуться.",
    fight_hit: "Удар прошёл по {name}. В этой игре атака — это шаг на клетку монстра.",
    fight_miss: "Промах по {name}. Монстр всё равно может ответить, потому что ход потрачен.",
    monster_hit: "{name} попал по тебе. Здоровье видно сверху, зелье возвращает его.",
    kill: "{name} побеждён. Иногда после этого на клетке остаётся золото.",
    pickup_gold: "Золото подобрано само, когда ты встал на клетку. Отдельно нажимать не нужно.",
    pickup_potion: "Зелье лежит в запасе, пока не нажмёшь «Выпить». В оригинале это часто клавиша q.",
    pickup_food: "Еда лежит в запасе. Её едят кнопкой, а не в тот же миг, когда подняли.",
    pickup_weapon: "Оружие надевается сразу, если оно сильнее того, что уже есть.",
    pickup_armor: "Броня надевается сразу и уменьшает шанс, что монстр пробьёт тебя.",
    pickup_amulet: "Это Амулет Йендора. Теперь путь наверх: на первый этаж и по лестнице наружу.",
    stairs_down: "Лестница вниз ведёт на следующий этаж. Карта прошлого этажа запоминается.",
    stairs_up: "Лестница вверх возвращает на предыдущий этаж.",
    stairs_blocked: "Выход уже здесь, но без амулета приключение не закончено.",
    win: "Победа. Ты принёс амулет из глубины на поверхность — так заканчивается классический Rogue.",
    dead: "Здоровье кончилось, партия окончена. В Rogue обычно начинают заново.",
    eat: "Еда снимает голод. Голод в Rogue — отдельный запас, не путай его со здоровьем.",
    drink: "Зелье лечения поднимает здоровье, но не выше максимума.",
    hungry: "Ты проголодался. Найди еду, она на карте отмечена знаком %.",
    very_hungry: "Голод уже отнимает здоровье. Съешь еду, пока партия не оборвалась."
  };

  function commentOnAction(action, context) {
    if (!notes[action]) {
      return "";
    }
    var name = "монстр";
    if (context && context.name) {
      name = context.name;
    }
    return notes[action].split("{name}").join(name);
  }

  function lessonForTurn(actions, context) {
    var names = (context && context.names) ? context.names : {};
    var rank = {
      dead: 100,
      win: 95,
      kill: 80,
      monster_hit: 70,
      fight_hit: 60,
      fight_miss: 60,
      pickup_amulet: 55,
      pickup_weapon: 50,
      pickup_armor: 50,
      pickup_potion: 50,
      pickup_food: 50,
      pickup_gold: 50,
      stairs_down: 40,
      stairs_up: 40,
      stairs_blocked: 40,
      eat: 30,
      drink: 30,
      very_hungry: 20,
      hungry: 15,
      wall: 10,
      move: 5,
      wait: 5
    };
    var best = "";
    var bestRank = -1;
    var i;
    for (i = 0; i < actions.length; i++) {
      var value = rank[actions[i]] !== undefined ? rank[actions[i]] : 0;
      if (value > bestRank) {
        bestRank = value;
        best = actions[i];
      }
    }
    var one = {
      name: names[best] || (context && context.name) || ""
    };
    var text = commentOnAction(best, one);
    var hungryToo = false;
    for (i = 0; i < actions.length; i++) {
      if (actions[i] === "very_hungry") {
        hungryToo = true;
      }
    }
    if (best !== "dead" && best !== "very_hungry" && hungryToo) {
      var extra = commentOnAction("very_hungry", context || {});
      if (extra !== "") {
        text = (text + " " + extra).replace(/^\s+|\s+$/g, "");
      }
    }
    return [best, text];
  }

  root.commentOnAction = commentOnAction;
  root.lessonForTurn = lessonForTurn;
})(typeof window !== "undefined" ? window : globalThis);
