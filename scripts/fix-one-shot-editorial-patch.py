from pathlib import Path

path = Path('scripts/one-shot-editorial-connected-patch.py')
text = path.read_text()
text = text.replace("write_text(r'''\\\n", "write_text(r'''\n")
path.write_text(text)
