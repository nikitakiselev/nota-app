#!/bin/sh
# Собирает css/tailwind.css из классов в index.html и js/.
# Запускать после любой правки классов в разметке, затем cache-bust.py.
# Версия закреплена: именно 3.4.17 отдавал cdn.tailwindcss.com, по которому
# вёрстка и выверялась; другая версия может сдвинуть вид.
set -eu
cd "$(dirname "$0")/.."
npx --yes tailwindcss@3.4.17 -c tailwind.config.js -i css/tailwind.src.css -o css/tailwind.css --minify
