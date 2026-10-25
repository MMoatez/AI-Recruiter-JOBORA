import os

import ollama
from pydantic import BaseModel

MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434")
OLLAMA_TIMEOUT_SECONDS = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "420"))
OLLAMA_NUM_PREDICT = int(os.getenv("OLLAMA_NUM_PREDICT", "384"))
client = ollama.Client(host=OLLAMA_HOST, timeout=OLLAMA_TIMEOUT_SECONDS)
health_client = ollama.Client(host=OLLAMA_HOST, timeout=5)

def ask(system: str, user: str, schema: type[BaseModel], temperature: float = 0.2):
    for _ in range(2):
        r = client.chat(
            model=MODEL,
            messages=[{"role": "system", "content": system},
                      {"role": "user", "content": user}],
            format=schema.model_json_schema(),   # force la structure de sortie
            options={
                "temperature": temperature,
                "num_predict": OLLAMA_NUM_PREDICT,
            },
            keep_alive="10m",
        )
        try:
            return schema.model_validate_json(r["message"]["content"])
        except Exception:
            continue
    raise RuntimeError("Le modèle n'a pas renvoyé un JSON valide")