# Fine-tuning de l'extraction Portfolio

Ce dossier ajoute un pipeline de **supervised fine-tuning** pour les quatre tâches d'extraction du Portfolio : `identity`, `experiences`, `projects` et `skills`.

Le mode recommandé est **QLoRA** : le modèle de base est chargé en 4 bits et seuls des adaptateurs LoRA sont entraînés. Le mode `full` est également disponible, mais exige beaucoup plus de mémoire GPU.

## Périmètre

Le modèle apprend à produire les schémas JSON du Portfolio à partir du texte d'un CV. Les protections existantes restent obligatoires : validation DTO, `assertArrayFields()` et `validateAgainstSource()`.

Le fine-tuning concerne uniquement l'extraction. L'accroche, la présentation et la reformulation des projets continuent à utiliser les prompts généraux.

## 1. Préparer les annotations

Le dataset source est un JSONL avec une ligne par section :

```json
{"cv_id":"cv-001","section":"projects","cv_text":"...","output":{"projects":[]}}
```

Les sections autorisées sont `identity`, `experiences`, `projects` et `skills`. Le script refuse les clés absentes ou supplémentaires dans `output`.

Le dépôt contient également un corpus synthétique reproductible :

- `data/train.annotations.jsonl` : 80 CV, soit 320 annotations ;
- `data/test.annotations.jsonl` : 20 CV jamais utilisés pour l'entraînement, soit 80 annotations ;
- `data/dataset-manifest.json` : provenance et taille du corpus.

Il est généré sans données personnelles réelles avec :

```powershell
npm run finetune:portfolio:dataset
npm run finetune:portfolio:audit
```

Ce corpus est suffisant pour une démonstration technique, mais un modèle destiné à un usage réel doit aussi être évalué sur des CV réels consentis, anonymisés et relus manuellement.

Depuis `JOBORA_Backend` :

```powershell
npm run finetune:portfolio:prepare -- --input finetuning/portfolio_extraction/data/train.annotations.jsonl
```

La séparation est effectuée par `cv_id` : les sections d'un même CV ne peuvent pas se retrouver à la fois dans l'entraînement et la validation.

## 2. Entraîner

L'entraînement nécessite un GPU CUDA. Sur Windows, WSL2/Linux est recommandé pour QLoRA et `bitsandbytes`.

```powershell
python -m venv .venv-finetune
.venv-finetune\Scripts\python -m pip install -r finetuning/portfolio_extraction/requirements.txt
.venv-finetune\Scripts\python finetuning/portfolio_extraction/train.py --method qlora
```

Modes disponibles :

- `qlora` : recommandé, modèle de base en 4 bits et adaptateurs LoRA ;
- `lora` : adaptateurs LoRA sans chargement 4 bits ;
- `full` : modification de tous les poids, nettement plus coûteuse.

Le modèle de base par défaut est `Qwen/Qwen2.5-3B-Instruct`, cohérent avec `qwen2.5:3b` utilisé par le backend.

### Mode local sans CUDA

Sur une machine de 8 Go de RAM sans GPU NVIDIA, utilise Python 3.12, `HuggingFaceTB/SmolLM2-135M-Instruct` et LoRA. Le modèle doit être téléchargé dans `base-models/smollm2-135m-instruct` ; ce dossier est ignoré par Git. Le test suivant entraîne deux étapes seulement afin de vérifier le pipeline :

```powershell
& 'C:\Users\Fatma\AppData\Local\Programs\Python\Python312\python.exe' -m venv .venv-finetune-cpu
.venv-finetune-cpu\Scripts\python -m pip install -r finetuning/portfolio_extraction/requirements-cpu.txt
.venv-finetune-cpu\Scripts\python finetuning/portfolio_extraction/train.py `
  --allow-cpu --method lora `
  --model finetuning/portfolio_extraction/base-models/smollm2-135m-instruct `
  --max-length 512 --gradient-accumulation 2 --max-steps 2
```

Après validation du test, supprime `--max-steps 2` et utilise `--epochs 3` pour l'entraînement complet. Cette exécution peut durer plusieurs heures sur CPU.

La fusion doit utiliser le même modèle de base :

```powershell
.venv-finetune-cpu\Scripts\python finetuning/portfolio_extraction/merge_adapter.py `
  --model finetuning/portfolio_extraction/base-models/smollm2-135m-instruct
```

## 3. Fusionner et importer dans Ollama

Pour LoRA ou QLoRA :

```powershell
.venv-finetune\Scripts\python finetuning/portfolio_extraction/merge_adapter.py
cd finetuning/portfolio_extraction
ollama create jobora-portfolio-extractor -f Modelfile
ollama run jobora-portfolio-extractor
```

Ollama 0.40 sous Windows ne charge pas ce répertoire Safetensors sans le runtime MLX. La voie validée est un GGUF Q8_0 généré avec `llama.cpp` b5272 :

```powershell
.venv-finetune-cpu\Scripts\python `
  finetuning/portfolio_extraction/.cache/llama.cpp-b5272/convert_hf_to_gguf.py `
  finetuning/portfolio_extraction/merged-model `
  --outfile finetuning/portfolio_extraction/merged-model/jobora-portfolio-extractor-q8_0.gguf `
  --outtype q8_0

cd finetuning/portfolio_extraction
ollama create jobora-portfolio-extractor -f Modelfile
```

## 4. Évaluer avant activation

```powershell
python finetuning/portfolio_extraction/evaluate_ollama.py --dataset chemin/validation.annotations.jsonl --model jobora-portfolio-extractor
python finetuning/portfolio_extraction/evaluate_ollama.py --model jobora-portfolio-extractor --limit 8
```

Le rapport contient le taux de JSON valide, la correspondance exacte, l'exactitude des champs de premier niveau et les erreurs d'appel. Compare le modèle ajusté au modèle de base sur les mêmes CV jamais vus pendant l'entraînement.

## 5. Activer dans JOBORA

Dans `JOBORA_Backend/.env` :

```env
OLLAMA_PORTFOLIO_EXTRACTION_MODEL=jobora-portfolio-extractor
```

Redémarre ensuite Ollama et le backend. `OLLAMA_MODEL` reste affecté à l'accroche, à la présentation et aux projets ; seul `OLLAMA_PORTFOLIO_EXTRACTION_MODEL` utilise le modèle spécialisé.

## Traçabilité universitaire

- méthode : SFT avec QLoRA par défaut ;
- modèle de base : Qwen2.5 3B Instruct ;
- données : CV anonymisés avec sorties JSON annotées ;
- prévention des fuites : séparation par `cv_id` ;
- métriques : JSON valide, exact match et exactitude par champ ;
- défense finale : DTO et comparaison avec le CV source.

Références : [TRL SFTTrainer](https://huggingface.co/docs/trl/sft_trainer), [PEFT](https://huggingface.co/docs/trl/main/peft_integration), [bitsandbytes](https://huggingface.co/docs/bitsandbytes/quickstart) et [import Ollama](https://github.com/ollama/ollama/blob/main/docs/import.mdx).
