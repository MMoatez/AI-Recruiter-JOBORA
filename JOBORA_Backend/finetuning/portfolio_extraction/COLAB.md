# Exécuter le fine-tuning sur Google Colab

La machine de développement ne possède pas de GPU CUDA. L'entraînement QLoRA de Qwen2.5 3B doit donc être exécuté sur une session Colab avec accélérateur GPU.

## 1. Rendre les fichiers accessibles

Pousse les changements du dossier `finetuning/portfolio_extraction` et ton dataset anonymisé vers une branche privée, ou téléverse ces fichiers manuellement dans Colab. Ne publie pas de CV contenant des données personnelles.

## 2. Activer le GPU

Dans Colab : **Exécution → Modifier le type d'exécution → GPU**.

Vérifie ensuite :

```python
!nvidia-smi
```

## 3. Récupérer le projet et installer les dépendances

```python
!git clone https://github.com/yassinjendoubi/JOBORA.git
%cd JOBORA/JOBORA_Backend
!python -m pip install -r finetuning/portfolio_extraction/requirements.txt
```

Pour une branche différente :

```python
!git checkout NOM_DE_LA_BRANCHE
```

## 4. Préparer et entraîner

Le corpus synthétique fourni peut être préparé directement :

```python
!python finetuning/portfolio_extraction/prepare_dataset.py \
  --input finetuning/portfolio_extraction/data/train.annotations.jsonl

!python finetuning/portfolio_extraction/train.py \
  --method qlora \
  --epochs 3
```

Le fichier `test.annotations.jsonl` reste totalement séparé et sert uniquement à comparer le modèle de base et le modèle fine-tuné.

## 5. Fusionner et télécharger

```python
!python finetuning/portfolio_extraction/merge_adapter.py
!zip -r jobora-portfolio-extractor.zip finetuning/portfolio_extraction/merged-model

from google.colab import files
files.download("jobora-portfolio-extractor.zip")
```

## 6. Activer localement

Décompresse `merged-model` dans `JOBORA_Backend/finetuning/portfolio_extraction/`, puis exécute :

```powershell
cd finetuning\portfolio_extraction
ollama create jobora-portfolio-extractor -f Modelfile
ollama run jobora-portfolio-extractor
```

Dans `JOBORA_Backend/.env` :

```env
OLLAMA_PORTFOLIO_EXTRACTION_MODEL=jobora-portfolio-extractor
```

Redémarre le backend, puis évalue le modèle sur des CV réservés à la validation :

```powershell
python finetuning\portfolio_extraction\evaluate_ollama.py `
  --dataset finetuning\portfolio_extraction\data\test.annotations.jsonl `
  --model jobora-portfolio-extractor
```
