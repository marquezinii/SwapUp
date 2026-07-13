from __future__ import annotations

import json
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from bs4 import BeautifulSoup
import requests

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "web" / "index.html"
CACHE = ROOT / "scripts" / "translation-cache.json"
OUTPUT = ROOT / "web" / "i18n-data.js"

LANGUAGES = {
    "en": "en", "es": "es", "fr": "fr", "de": "de", "it": "it",
    "nl": "nl", "pl": "pl", "ru": "ru", "tr": "tr", "ar": "ar",
    "hi": "hi", "zh-CN": "zh-CN", "ja": "ja", "ko": "ko", "id": "id",
}

DYNAMIC_PHRASES = {
    "Próximos eventos", "Nenhum evento neste período", "Sua agenda está tranquila. Adicione seu próximo compromisso.",
    "Sua agenda está livre", "Aproveite o tempo ou planeje algo novo.", "Dia inteiro", "Editar", "eventos",
    "NOVO COMPROMISSO", "Adicionar evento", "EDITAR COMPROMISSO", "Editar evento",
    "O horário final precisa ser após o início.", "Evento atualizado.", "Evento adicionado à sua agenda.",
    "Excluir este evento da sua agenda?", "Evento excluído.", "Digite primeiro um endereço.",
    "Categoria criada.", "Configurações salvas.", "Backup restaurado com sucesso.",
    "Esse arquivo não é um backup válido do SwapUp!.", "Hoje", "Sem título", "Conta local",
    "Abrir SwapUp!", "Novo evento", "Sair", "SwapUp! continua ativo",
    "Seus lembretes ficam funcionando na bandeja. Clique duas vezes no ícone para abrir.",
    "O SwapUp! já está aberto na bandeja do sistema.",
    "Seu calendário",
    "Pessoal", "Trabalho", "Saúde", "Importante", "Uso pessoal",
    "Oculto na agenda", "Visível na agenda", "Excluir", "É necessário manter pelo menos um calendário.",
    "Excluir o calendário", "evento será movido", "eventos serão movidos", "para",
    "Calendário excluído e eventos preservados.", "Calendário criado.",
    "Escolha uma imagem PNG, JPG ou WebP de até 8 MB.", "Foto pronta. Salve as alterações para aplicar.",
    "Foto removida. Salve as alterações para aplicar.", "A imagem deve ser PNG, JPG ou WebP e ter no máximo 5 MB.",
    "Preencha o resumo e a descrição antes de copiar.", "Relatório copiado.",
    "Não foi possível copiar automaticamente. Selecione e copie os campos manualmente.", "Preparando o relatório...",
    "O canal de suporte ainda não foi configurado pelo desenvolvedor.",
    "Seu aplicativo de e-mail foi aberto. Revise e envie a mensagem.", "O relatório foi salvo neste computador.",
    "Canal de envio configurado e pronto para uso.", "Canal de envio ainda não configurado neste build. Os relatos ficam salvos localmente.",
    "Salvar backup do SwapUp!", "Restaurar backup do SwapUp!", "Arquivo JSON", "Backup SwapUp!",
    "Alterações salvas", "Cor personalizada aplicada.", "Cor inválida.",
    "Excluir evento?", "Excluir evento", "Excluir calendário?", "Esta ação não pode ser desfeita.",
    "Automático (idioma do sistema)",
    "domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado",
}


def collect_phrases() -> list[str]:
    soup = BeautifulSoup(HTML.read_text(encoding="utf-8"), "html.parser")
    language_select = soup.select_one("#settingLanguage")
    phrases = set(DYNAMIC_PHRASES)
    for node in soup.find_all(string=True):
        if node.parent.name in {"script", "style"} or (language_select and node in language_select.descendants):
            continue
        text = re.sub(r"\s+", " ", str(node)).strip()
        if len(text) > 1 and re.search(r"[A-Za-zÀ-ÿА-Яа-я一-龥ぁ-んァ-ン가-힣]", text):
            phrases.add(text)
    for tag in soup.find_all(True):
        if language_select and tag in language_select.descendants:
            continue
        for attr in ("placeholder", "title", "aria-label"):
            value = tag.get(attr, "").strip()
            if len(value) > 1 and re.search(r"[A-Za-zÀ-ÿ]", value):
                phrases.add(value)
    return sorted(phrases, key=lambda x: (len(x), x.casefold()))


def translate_language(code: str, target: str, phrases: list[str], existing: dict[str, str]) -> tuple[str, dict[str, str]]:
    session = requests.Session()
    result = {phrase: existing[phrase] for phrase in phrases if existing.get(phrase)}
    for source in list(result):
        if "SwapUp!" in source and "SwapUp!" not in result[source]:
            del result[source]
    missing = [p for p in phrases if not result.get(p)]
    for index, phrase in enumerate(missing, 1):
        for attempt in range(4):
            try:
                if phrase == "SwapUp!":
                    result[phrase] = phrase
                    break
                brand_token = "ZXQSWAPUPZXQ"
                payload = phrase.replace("SwapUp!", brand_token)
                response = session.get(
                    "https://translate.googleapis.com/translate_a/single",
                    params={"client": "gtx", "sl": "pt", "tl": target, "dt": "t", "q": payload},
                    timeout=15,
                )
                response.raise_for_status()
                translated = "".join(part[0] for part in response.json()[0] if part[0])
                translated = re.sub(r"ZXQ\s*SWAPUP\s*ZXQ", "SwapUp!", translated, flags=re.IGNORECASE)
                if translated:
                    result[phrase] = translated
                    break
            except Exception:
                if attempt == 3:
                    raise
                time.sleep(1.2 * (attempt + 1))
        if index % 25 == 0:
            print(f"[{code}] {index}/{len(missing)}", flush=True)
    return code, result


def main() -> None:
    phrases = collect_phrases()
    print(f"{len(phrases)} frases encontradas", flush=True)
    if "--list" in sys.argv:
        print("\n".join(phrases))
        return
    cache = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}
    translations: dict[str, dict[str, str]] = {"pt-BR": {p: p for p in phrases}}
    with ThreadPoolExecutor(max_workers=15) as pool:
        jobs = [pool.submit(translate_language, code, target, phrases, cache.get(code, {})) for code, target in LANGUAGES.items()]
        for job in as_completed(jobs):
            code, values = job.result()
            translations[code] = values
            cache[code] = values
            CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"[{code}] concluído", flush=True)
    missing = {code: [p for p in phrases if not values.get(p)] for code, values in translations.items()}
    if any(missing.values()):
        raise RuntimeError(f"Traduções ausentes: {missing}")
    payload = json.dumps(translations, ensure_ascii=False, separators=(",", ":"))
    OUTPUT.write_text("window.SWAPUP_TRANSLATIONS=" + payload + ";\n", encoding="utf-8")
    print(f"Gerado {OUTPUT} com {len(translations)} idiomas e {len(phrases)} frases.")


if __name__ == "__main__":
    main()
