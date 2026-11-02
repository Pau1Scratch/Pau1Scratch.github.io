# Pau1Scratch

Учебный сайт: проекты, плитки Вана и короткая версия Rogue.

Сайт статический. Его открывает GitHub Pages: HTML, CSS и JavaScript. PHP не нужен.

Адрес после публикации — страница GitHub Pages этого репозитория, обычно `https://pau1scratch.github.io/`.

## Как открыть у себя на компьютере

В этой папке выполни:

```
python -m http.server 8080
```

Потом открой http://localhost:8080

Телефон в той же сети открывает http://IP-адрес-компьютера:8080

## Что править

- Кнопки будущих проектов и переход на их страницы: `index.html`. Над каждой кнопкой есть комментарий.
- Учебные пометки к ходам Rogue: `assets/js/lesson.js`
- Правила плиток: `assets/js/tiles.js`
- Подземелье: `assets/js/rogue.js`
- Внешний вид: `assets/css/site.css`
- Картинки-заполнители: `assets/img/placeholders/`

Позиции плиток и партия Rogue запоминаются в браузере (localStorage). Другой браузер начинает заново.

Проверка страниц: `python tools/selftest.py`
