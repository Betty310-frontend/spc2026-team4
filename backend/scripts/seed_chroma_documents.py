import csv
import os
import re
import shutil
import zlib
from pathlib import Path

import chromadb
import fitz
import olefile
from dotenv import load_dotenv
from openai import OpenAI


BASE_DIR = Path(__file__).resolve().parents[1]
RAG_DIR = BASE_DIR / "data" / "rag"
MAP_CSV = RAG_DIR / "rag_map.csv"
CHROMA_DIR = BASE_DIR / "data" / "chroma"

COLLECTION_NAME = "business_rag"

MAX_CHARS = 1000
OVERLAP = 150


def clean_text(text: str) -> str:
    text = text.replace("\x00", "")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_pdf_text(path: Path) -> str:
    doc = fitz.open(path)
    texts = []

    for page in doc:
        page_text = page.get_text("text").strip()
        if page_text:
            texts.append(page_text)

    return clean_text("\n\n".join(texts))


def extract_hwp_text(path: Path) -> str:
    hwp = olefile.OleFileIO(str(path))
    is_compressed = hwp.openstream("FileHeader").read()[36] & 1

    sections = [
        name for name in hwp.listdir()
        if len(name) >= 2 and name[0] == "BodyText" and name[1].startswith("Section")
    ]

    sections.sort(key=lambda x: int(x[1].replace("Section", "")))

    result = []

    for section in sections:
        data = hwp.openstream(section).read()

        if is_compressed:
            data = zlib.decompress(data, -15)

        i = 0
        while i < len(data):
            header = int.from_bytes(data[i:i + 4], "little")
            rec_type = header & 0x3ff
            rec_len = (header >> 20) & 0xfff
            i += 4

            rec_data = data[i:i + rec_len]
            i += rec_len

            if rec_type == 67:
                try:
                    result.append(rec_data.decode("utf-16"))
                except UnicodeDecodeError:
                    pass

    return clean_text("\n".join(result))


def extract_text(path: Path) -> tuple[str, str]:
    suffix = path.suffix.lower()

    if suffix == ".pdf":
        return extract_pdf_text(path), "pdf"

    if suffix == ".hwp":
        return extract_hwp_text(path), "hwp"

    raise ValueError(f"지원하지 않는 파일 형식: {path}")


def split_long_text(text: str, section_title: str) -> list[dict]:
    chunks = []
    start = 0
    idx = 0

    while start < len(text):
        chunk_text = text[start:start + MAX_CHARS].strip()

        if chunk_text:
            chunks.append({
                "section_title": f"{section_title}-{idx}",
                "chunk_text": chunk_text,
            })
            idx += 1

        start += MAX_CHARS - OVERLAP

    return chunks


def split_chunks(text: str) -> list[dict]:
    pattern = r"(제\s*\d+\s*조\s*[\[\(][^\]\)]+[\]\)]|제\s*\d+\s*장\s+[^\n]+)"
    parts = re.split(pattern, text)

    raw_chunks = []

    if parts and parts[0].strip():
        raw_chunks.append({
            "section_title": "문서 서문",
            "chunk_text": parts[0].strip(),
        })

    for i in range(1, len(parts), 2):
        title = parts[i].strip()
        body = parts[i + 1].strip() if i + 1 < len(parts) else ""

        if body:
            raw_chunks.append({
                "section_title": title,
                "chunk_text": f"{title}\n{body}",
            })

    if not raw_chunks:
        raw_chunks = [{
            "section_title": "문서 전체",
            "chunk_text": text,
        }]

    final_chunks = []

    for chunk in raw_chunks:
        if len(chunk["chunk_text"]) > MAX_CHARS:
            final_chunks.extend(
                split_long_text(chunk["chunk_text"], chunk["section_title"])
            )
        else:
            final_chunks.append(chunk)

    return final_chunks


def embed_text(client: OpenAI, text: str) -> list[float]:
    safe_text = text[:6000]

    res = client.embeddings.create(
        model="text-embedding-3-small",
        input=safe_text,
    )
    return res.data[0].embedding


def collect_files(include_paths: list[str]) -> list[Path]:
    files: list[Path] = []

    for relative_dir in include_paths:
        target_dir = RAG_DIR / relative_dir

        if not target_dir.exists():
            print(f"[WARN] 폴더 없음: {target_dir}")
            continue

        files.extend(target_dir.glob("*.pdf"))
        files.extend(target_dir.glob("*.hwp"))

    return sorted(set(files))


def reset_chroma() -> chromadb.Collection:
    if CHROMA_DIR.exists():
        shutil.rmtree(CHROMA_DIR)

    CHROMA_DIR.mkdir(parents=True, exist_ok=True)

    client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    return client.get_or_create_collection(name=COLLECTION_NAME)


def main():
    load_dotenv(BASE_DIR / ".env.local", override=True)

    openai_client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    collection = reset_chroma()

    total_chunks = 0

    with MAP_CSV.open("r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)

        for row in reader:
            display_name = row["display_name"].strip()
            include_paths = [
                p.strip() for p in row["include_paths"].split(";") if p.strip()
            ]

            files = collect_files(include_paths)

            print(f"\n[RAG] {display_name} 문서 {len(files)}개 처리 시작")

            for file_path in files:
                relative_path = file_path.relative_to(BASE_DIR).as_posix()
                document_title = file_path.stem

                print(f"[RAG] 읽는 중: {relative_path}")

                try:
                    text, file_type = extract_text(file_path)
                except Exception as e:
                    print(f"[SKIP] 추출 실패: {file_path.name} / {e}")
                    continue

                if not text:
                    print(f"[SKIP] 텍스트 없음: {file_path.name}")
                    continue

                chunks = split_chunks(text)
                print(f"[RAG] chunk 생성: {len(chunks)}개")

                ids = []
                documents = []
                embeddings = []
                metadatas = []

                for idx, chunk in enumerate(chunks):
                    chunk_text = chunk["chunk_text"][:MAX_CHARS]

                    embedding_input = f"""
업종: {display_name}
문서명: {document_title}
파일형식: {file_type}
섹션: {chunk["section_title"]}

내용:
{chunk_text}
""".strip()

                    print(
                        f"[EMBED] {display_name} / {document_title} "
                        f"chunk={idx + 1}/{len(chunks)} "
                        f"chars={len(chunk_text)}"
                    )

                    embedding = embed_text(openai_client, embedding_input)

                    chunk_id = (
                        f"{display_name}|{relative_path}|{idx}"
                        .replace("\\", "/")
                    )

                    ids.append(chunk_id)
                    documents.append(chunk_text)
                    embeddings.append(embedding)
                    metadatas.append({
                        "display_name": display_name,
                        "document_title": document_title,
                        "file_path": relative_path,
                        "file_type": file_type,
                        "section_title": chunk["section_title"],
                        "chunk_index": idx,
                    })

                if ids:
                    collection.add(
                        ids=ids,
                        documents=documents,
                        embeddings=embeddings,
                        metadatas=metadatas,
                    )
                    total_chunks += len(ids)

                print(
                    f"[OK] {display_name} / {document_title} "
                    f"/ {file_type} / chunk {len(chunks)}개"
                )

    print(f"\n[DONE] ChromaDB 적재 완료: {total_chunks} chunks")
    print(f"[DONE] 저장 위치: {CHROMA_DIR}")


if __name__ == "__main__":
    main()