from __future__ import annotations

import argparse
from pathlib import Path


ROOT = Path(__file__).resolve().parent


def main() -> None:
    parser = argparse.ArgumentParser(description="Fusionne l'adaptateur LoRA avec le modèle de base.")
    parser.add_argument("--model", default="Qwen/Qwen2.5-3B-Instruct")
    parser.add_argument("--adapter", type=Path, default=ROOT / "output")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "merged-model")
    parser.add_argument("--cache-dir", type=Path, default=ROOT / ".cache")
    args = parser.parse_args()

    import torch
    from peft import PeftModel
    from transformers import AutoModelForCausalLM, AutoTokenizer

    if not (args.adapter / "adapter_config.json").exists():
        raise FileNotFoundError("Adaptateur LoRA introuvable. Exécute d'abord train.py avec lora ou qlora.")
    base = AutoModelForCausalLM.from_pretrained(
        args.model,
        dtype=torch.float32,
        device_map="cpu",
        low_cpu_mem_usage=True,
        cache_dir=str(args.cache_dir),
    )
    merged = PeftModel.from_pretrained(base, args.adapter).merge_and_unload()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    merged.save_pretrained(args.output_dir, safe_serialization=True, max_shard_size="4GB")
    AutoTokenizer.from_pretrained(
        args.model,
        use_fast=True,
        cache_dir=str(args.cache_dir),
    ).save_pretrained(args.output_dir)
    print(f"Modèle fusionné enregistré dans {args.output_dir}")


if __name__ == "__main__":
    main()
