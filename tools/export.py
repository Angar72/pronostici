#!/usr/bin/env python3
"""Converte i documenti scaricati con ArtifactData list (cartella/<collezione>/<id>.json)
in data/<collezione>.json = {id: dati}, letti dal sito."""
import json, os, sys
src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
for coll in ["leagues", "odds", "news", "tracking", "live", "lotto"]:
    d = os.path.join(src, coll)
    if not os.path.isdir(d):
        continue
    out = {}
    for f in sorted(os.listdir(d)):
        if not f.endswith(".json"):
            continue
        j = json.load(open(os.path.join(d, f), encoding="utf-8"))
        out[f[:-5]] = j.get("data", j) if isinstance(j, dict) else j
    out.pop("log", None)
    json.dump(out, open(os.path.join(dst, coll + ".json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(coll, len(out))
