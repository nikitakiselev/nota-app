#!/usr/bin/env python3
"""Проставляет в index.html хеш содержимого к ссылкам на локальные файлы.

GitHub Pages отдаёт всё с `Cache-Control: max-age=600`, и поменять это
нельзя. Без версии в адресе браузер после деплоя ещё 10 минут показывал
старые скриншоты, стили и скрипт — на живом сайте это выглядело как
«ничего не обновилось». Номер версии руками тоже не спасает: поменяли
только картинку, забыли поднять `?v=` — снова старьё.

Поэтому версия — первые 8 символов SHA-256 самого файла: изменился
файл — изменился адрес. Скрипт идемпотентен, запускать перед каждым
коммитом: `python3 scripts/cache-bust.py`.
"""
import hashlib
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = ROOT / "index.html"
# Только относительные ссылки на файлы сайта: внешние CDN, якоря и
# mailto не трогаем.
LINK = re.compile(r'(?P<attr>src|href)="(?P<path>(?:assets|css|js)/[^"?#]+)(?:\?v=[^"#]*)?"')


def digest(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:8]


def main() -> int:
    source = PAGE.read_text(encoding="utf-8")
    missing = []

    def bust(match: re.Match) -> str:
        path = ROOT / match["path"]
        if not path.is_file():
            missing.append(match["path"])
            return match[0]
        return f'{match["attr"]}="{match["path"]}?v={digest(path)}"'

    updated = LINK.sub(bust, source)
    # Ссылка на несуществующий файл — битая картинка на живом сайте.
    # Молча пропустить её значит узнать об этом от посетителя.
    if missing:
        print("нет файлов: " + ", ".join(sorted(set(missing))), file=sys.stderr)
        return 1
    if updated != source:
        PAGE.write_text(updated, encoding="utf-8")
        print("index.html: хеши обновлены")
    else:
        print("index.html: хеши актуальны")
    return 0


if __name__ == "__main__":
    sys.exit(main())
