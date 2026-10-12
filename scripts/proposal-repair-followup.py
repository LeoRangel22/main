from pathlib import Path
p = Path('app.js')
s = p.read_text()
old = 'function getSupabaseSaveErrorMessage(error, context = {}) {\n'
new = old + '  if (error?.code === "SAVE_UNCONFIRMED") return error.message || "Não foi possível confirmar a gravação. Confira o histórico antes de repetir.";\n'
assert s.count(old) == 1
assert 'if (error?.code === "SAVE_UNCONFIRMED")' not in s
p.write_text(s.replace(old, new, 1))
