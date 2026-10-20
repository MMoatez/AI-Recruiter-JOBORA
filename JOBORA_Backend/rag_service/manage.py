from __future__ import annotations

import argparse
import json

from rag_store import RagStore


def main() -> None:
    parser = argparse.ArgumentParser(description="Manage JOBORA's local persistent RAG index.")
    subcommands = parser.add_subparsers(dest="command", required=True)
    index_parser = subcommands.add_parser("index")
    index_parser.add_argument("--force", action="store_true")
    search_parser = subcommands.add_parser("search")
    search_parser.add_argument("query")
    search_parser.add_argument("--top-k", type=int, default=5)
    subcommands.add_parser("status")
    arguments = parser.parse_args()
    store = RagStore()

    if arguments.command == "index":
        result = {"indexed": store.ensure_index(arguments.force), **store.status()}
    elif arguments.command == "search":
        result = {"query": arguments.query, "chunks": store.search(arguments.query, arguments.top_k)}
    else:
        result = store.diagnostic()
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
