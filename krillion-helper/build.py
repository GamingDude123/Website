#!/usr/bin/env python3
"""Embeds categories.txt into puffer-helper.user.js. Run after editing categories.txt."""
import json, re
data = open("categories.txt", encoding="utf-8").read().strip()
js = open("puffer-helper.user.js", encoding="utf-8").read()
block = "/*@@DATA_START@@*/\nconst DATA = %s;\n/*@@DATA_END@@*/" % json.dumps(data, ensure_ascii=False)
js = re.sub(r"/\*@@DATA_START@@\*/.*?/\*@@DATA_END@@\*/", lambda m: block, js, flags=re.S)
open("puffer-helper.user.js", "w", encoding="utf-8").write(js)
print("embedded", len(data.splitlines()), "categories")
