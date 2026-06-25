import os
from pathlib import Path

import chromadb
from dotenv import load_dotenv
from openai import OpenAI
from typing import Any, cast

BASE_DIR = Path(__file__).resolve().parents[2]
CHROMA_DIR = BASE_DIR / "data" / "chroma"
COLLECTION_NAME = "business_rag"

load_dotenv(BASE_DIR / ".env.local", override=True)

api_key = os.getenv("OPENAI_API_KEY")

openai_client = OpenAI(api_key=api_key) if api_key else None

collection = chromadb.PersistentClient(path=str(CHROMA_DIR)).get_or_create_collection(name=COLLECTION_NAME)


def embed_query(question: str) -> list[float]:
    if openai_client is None:
        raise RuntimeError("OPENAI_API_KEY is not configured.")

    res = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=question,
    )
    return res.data[0].embedding


def search_rag_chunks(
    display_name: str,
    question: str,
    n_results: int = 5,
) -> list[dict]:
    query_embedding = embed_query(question)

    result = cast(
        dict[str, Any],
        collection.query(
            query_embeddings=[query_embedding],  # type: ignore[arg-type]
            n_results=n_results,
            where={"display_name": display_name},
            include=["documents", "metadatas", "distances"],
        ),
    )

    documents = cast(list[list[str]], result.get("documents") or [[]])[0]
    metadatas = cast(list[list[dict[str, Any]]], result.get("metadatas") or [[]])[0]
    distances = cast(list[list[float]], result.get("distances") or [[]])[0]

    chunks = []

    for doc, meta, distance in zip(documents, metadatas, distances):
        chunks.append({
            "document_title": meta.get("document_title"),
            "file_path": meta.get("file_path"),
            "file_type": meta.get("file_type"),
            "section_title": meta.get("section_title"),
            "chunk_text": doc,
            "distance": distance,
        })

    return chunks


def generate_rag_answer(
    display_name: str,
    question: str,
    n_results: int = 5,
) -> dict:
    if openai_client is None:
        raise RuntimeError("OPENAI_API_KEY is not configured.")

    chunks = search_rag_chunks(display_name, question, n_results)

    if not chunks:
        return {
            "answer": "관련 근거 문서를 찾지 못했습니다.",
            "sources": [],
        }

    context = "\n\n".join(
        f"[근거 {idx + 1}]\n"
        f"문서: {chunk['document_title']}\n"
        f"섹션: {chunk['section_title']}\n"
        f"내용:\n{chunk['chunk_text']}"
        for idx, chunk in enumerate(chunks)
    )

    prompt = f"""
너는 창업 관련 법령/계약서 기반 RAG 챗봇이다.

반드시 아래 근거 문서만 사용해서 답변해라.
근거에 없는 내용은 추측하지 말고 "문서에서 확인되지 않습니다"라고 말해라.
답변은 사용자가 이해하기 쉽게 정리해라.
마지막에 참고 문서를 표시해라.

업종: {display_name}
질문: {question}

근거:
{context}
""".strip()

    res = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "너는 근거 기반 RAG assistant다."},
            {"role": "user", "content": prompt},
        ],
    )

    return {
        "answer": res.choices[0].message.content,
        "sources": chunks,
    }