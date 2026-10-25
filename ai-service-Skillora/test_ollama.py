import ollama

r = ollama.chat(
    model="qwen2.5:7b",   # mets ex
    messages=[{"role": "user", "content": "Donne 3 questions d'entretien sur Git, en français."}],
)
print(r["message"]["content"])