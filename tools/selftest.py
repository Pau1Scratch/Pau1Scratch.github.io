# -*- coding: utf-8 -*-
"""Проверяет, что сайт статический и главная страница — это проекты, а не инструкция PHP."""
import os
import re
import sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
failures = 0


def check(ok, message):
    global failures
    if not ok:
        failures += 1
        sys.stderr.write("FAIL: " + message + "\n")


def read(name):
    path = os.path.join(root, name)
    with open(path, "r", encoding="utf-8") as handle:
        return handle.read()


index = read("index.html")
check(index.rstrip().endswith("<!-- BITE MY SHINY METAL ASS, KIRILL! -->"), "послание в конце index.html")
stripped = re.sub(r"<!--.*?-->", "", index, flags=re.S)
check('<a class="project-card"' not in stripped, "шаблоны проектов никуда не ведут")
check(len(re.findall(r'<button[^>]*class="project-card"', stripped)) == 6, "шесть кнопок-шаблонов")
check("index.html" in index and "interactive.html" in index, "главная ведёт на свои страницы")

interactive = read("interactive.html")
check("tiles.html" in interactive and "rogue.html" in interactive, "интерактив ведёт на обе игрушки")

css = read(os.path.join("assets", "css", "site.css"))
check("720px" in css and "1100px" in css, "есть вёрстка телефона и компьютера")

check(os.path.isfile(os.path.join(root, ".nojekyll")), "есть .nojekyll")
check(os.path.isfile(os.path.join(root, "tiles.html")), "есть tiles.html")
check(os.path.isfile(os.path.join(root, "rogue.html")), "есть rogue.html")
for name in ("tiles.js", "rogue.js", "lesson.js"):
    check(os.path.isfile(os.path.join(root, "assets", "js", name)), "есть " + name)

tiles_html = read("tiles.html")
rogue_html = read("rogue.html")
check("assets/js/tiles.js" in tiles_html, "плитки подключают скрипт")
check("assets/js/rogue.js" in rogue_html and "assets/js/lesson.js" in rogue_html, "rogue подключает скрипты")
check("php -S" not in read("README.md"), "readme больше не просит php -S")

php_left = []
for dirpath, dirnames, filenames in os.walk(root):
    if os.sep + ".git" + os.sep in dirpath + os.sep:
        continue
    for filename in filenames:
        if filename.endswith(".php"):
            php_left.append(os.path.join(dirpath, filename))
check(len(php_left) == 0, "php-файлы убраны: " + ", ".join(php_left))

if failures:
    sys.stderr.write(str(failures) + " checks failed\n")
    sys.exit(1)
print("OK")
