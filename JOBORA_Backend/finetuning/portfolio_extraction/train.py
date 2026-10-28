from __future__ import annotations

import argparse
from pathlib import Path


ROOT = Path(__file__).resolve().parent


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fine-tuning supervisé de l'extracteur Portfolio.")
    parser.add_argument("--model", default="Qwen/Qwen2.5-3B-Instruct")
    parser.add_argument("--method", choices=("qlora", "lora", "full"), default="qlora")
    parser.add_argument("--train-file", type=Path, default=ROOT / "prepared" / "train.jsonl")
    parser.add_argument("--validation-file", type=Path, default=ROOT / "prepared" / "validation.jsonl")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "output")
    parser.add_argument("--cache-dir", type=Path, default=ROOT / ".cache")
    parser.add_argument("--epochs", type=float, default=3.0)
    parser.add_argument("--learning-rate", type=float)
    parser.add_argument("--batch-size", type=int, default=1)
    parser.add_argument("--gradient-accumulation", type=int, default=8)
    parser.add_argument("--max-length", type=int, default=4096)
    parser.add_argument("--max-steps", type=int, default=-1)
    parser.add_argument("--allow-cpu", action="store_true")
    parser.add_argument("--seed", type=int, default=42)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.train_file.exists() or not args.validation_file.exists():
        raise FileNotFoundError("Prépare d'abord le dataset avec prepare_dataset.py")

    import torch
    from datasets import load_dataset
    from peft import LoraConfig, prepare_model_for_kbit_training
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
    from trl import SFTConfig, SFTTrainer

    has_cuda = torch.cuda.is_available()
    if not has_cuda and not args.allow_cpu:
        raise RuntimeError(
            "Aucun GPU CUDA détecté. Pour un test local, utilise --allow-cpu --method lora "
            "--model Qwen/Qwen2.5-0.5B-Instruct --max-length 1024."
        )
    if not has_cuda and args.method != "lora":
        raise RuntimeError("Le mode CPU local prend uniquement en charge --method lora.")

    compute_dtype = (
        torch.bfloat16 if has_cuda and torch.cuda.is_bf16_supported()
        else torch.float16 if has_cuda
        else torch.float32
    )
    quantization_config = None
    if args.method == "qlora":
        quantization_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_use_double_quant=True,
            bnb_4bit_compute_dtype=compute_dtype,
        )

    args.cache_dir.mkdir(parents=True, exist_ok=True)
    model_kwargs = {
        "dtype": compute_dtype,
        "quantization_config": quantization_config,
        "low_cpu_mem_usage": True,
        "cache_dir": str(args.cache_dir),
    }
    if has_cuda:
        model_kwargs["device_map"] = "auto"
    model = AutoModelForCausalLM.from_pretrained(args.model, **model_kwargs)
    model.config.use_cache = False
    if args.method == "qlora":
        model = prepare_model_for_kbit_training(model)

    tokenizer = AutoTokenizer.from_pretrained(
        args.model,
        use_fast=True,
        cache_dir=str(args.cache_dir),
    )
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    dataset = load_dataset(
        "json",
        data_files={
            "train": str(args.train_file),
            "validation": str(args.validation_file),
        },
        cache_dir=str(args.cache_dir / "datasets"),
    )
    peft_config = None
    if args.method != "full":
        peft_config = LoraConfig(
            r=16,
            lora_alpha=32,
            lora_dropout=0.05,
            bias="none",
            task_type="CAUSAL_LM",
            target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        )

    training_args = SFTConfig(
        output_dir=str(args.output_dir),
        num_train_epochs=args.epochs,
        max_steps=args.max_steps,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=1,
        gradient_accumulation_steps=args.gradient_accumulation,
        learning_rate=args.learning_rate or (2e-4 if peft_config else 2e-5),
        warmup_steps=0.05,
        lr_scheduler_type="cosine",
        optim="adamw_torch",
        logging_steps=5,
        eval_strategy="epoch",
        save_strategy="epoch",
        save_total_limit=2,
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        max_length=args.max_length,
        completion_only_loss=True,
        packing=False,
        gradient_checkpointing=has_cuda,
        bf16=has_cuda and compute_dtype == torch.bfloat16,
        fp16=has_cuda and compute_dtype == torch.float16,
        dataloader_pin_memory=has_cuda,
        use_cpu=not has_cuda,
        report_to="none",
        seed=args.seed,
    )
    trainer = SFTTrainer(
        model=model,
        args=training_args,
        train_dataset=dataset["train"],
        eval_dataset=dataset["validation"],
        processing_class=tokenizer,
        peft_config=peft_config,
    )
    trainer.train()
    trainer.save_model(str(args.output_dir))
    tokenizer.save_pretrained(args.output_dir)


if __name__ == "__main__":
    main()
