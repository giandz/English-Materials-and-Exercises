"""Rebuild index.json after adding or removing character files.
Run it inside the characters folder:  python make_index.py
The scene pages read index.json to find the files when they are on a web server (GitHub Pages)."""
import json, os
here = os.path.dirname(os.path.abspath(__file__))
files = sorted(f for f in os.listdir(here) if f.endswith('.json') and f != 'index.json')
with open(os.path.join(here, 'index.json'), 'w') as fh:
    json.dump({'files': files}, fh, indent=1)
print(len(files), 'files listed in index.json')
