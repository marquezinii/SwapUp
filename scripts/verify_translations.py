from __future__ import annotations

import json
from pathlib import Path

from bs4 import BeautifulSoup

from generate_translations import BRAND_NAMES, SOURCE_BRAND, collect_phrases

ROOT = Path(__file__).resolve().parents[1]
raw = (ROOT / "web" / "i18n-data.js").read_text(encoding="utf-8")
packs = json.loads(raw.removeprefix("window.SWAPUP_TRANSLATIONS=").removesuffix(";\n"))
expected_languages = {"pt-BR", "en", "es", "fr", "de", "it", "nl", "pl", "ru", "tr", "ar", "hi", "zh-CN", "ja", "ko", "id"}
phrases = collect_phrases()
critical = [
    "Configurações", "Salvar alterações", "Meu perfil", "Adicionar evento",
    "Desenvolvido por Felipe Marquezini", "© 2026 SwapUp! Agenda ©. Todos os direitos reservados.",
    "Cor de destaque", "Alterações salvas", "Automático (idioma do sistema)",
]

assert set(packs) == expected_languages, f"Idiomas incorretos: {set(packs) ^ expected_languages}"
for code, values in packs.items():
    missing = [phrase for phrase in phrases if not values.get(phrase)]
    assert not missing, f"{code}: {len(missing)} traduções ausentes: {missing[:5]}"
    assert all(key in values for key in critical), f"{code}: texto crítico ausente"
    assert len(values) == len(phrases), f"{code}: esperado {len(phrases)}, recebido {len(values)}"
    assert all(BRAND_NAMES[code] in translated for source, translated in values.items() if SOURCE_BRAND in source), f"{code}: nome localizado da marca ausente"

soup = BeautifulSoup((ROOT / "web" / "index.html").read_text(encoding="utf-8"), "html.parser")
language_values = {option.get("value") for option in soup.select("#settingLanguage option") if option.get("value") != "system"}
assert language_values == expected_languages, "Seletor de idioma não corresponde aos pacotes disponíveis"
assert (ROOT / "web" / "i18n.js").read_text(encoding="utf-8").count("'ar'") >= 1, "Suporte RTL árabe ausente"

print(f"OK: {len(packs)} idiomas × {len(phrases)} frases = {len(packs) * len(phrases)} entradas verificadas.")
print("OK: seletor, textos críticos, copyright e suporte RTL verificados.")
