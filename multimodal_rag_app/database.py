import chromadb
from sentence_transformers import SentenceTransformer
import numpy as np
from PIL import Image
import cv2
import os
import fitz  # PyMuPDF
import docx

# --- Configuration ---
DB_PATH = "chroma_db"
COLLECTION_NAME = "multimodal_collection"
EMBEDDING_MODEL = 'clip-ViT-B-32'

# --- Initialization ---
# This part can be slow as it might download the model on first run.
print("Initializing database and embedding model...")
client = chromadb.PersistentClient(path=DB_PATH)
model = SentenceTransformer(EMBEDDING_MODEL)
print("Initialization complete.")


# Get or create the collection. This is an idempotent operation.
collection = client.get_or_create_collection(name=COLLECTION_NAME)

# --- Helper Functions ---

def _embed_text(text):
    """Embeds a string of text."""
    return model.encode(text).tolist()

def _embed_image(image_path):
    """Embeds an image from a file path."""
    image = Image.open(image_path)
    return model.encode(image).tolist()

def _embed_video(video_path, sample_rate=1): # sample 1 frame per second
    """Embeds a video by sampling frames."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"Error: Could not open video file {video_path}")
        return []

    frame_rate = cap.get(cv2.CAP_PROP_FPS)
    if frame_rate == 0:
        print(f"Warning: Frame rate of video {video_path} is 0. Cannot process.")
        cap.release()
        return []

    frame_interval = int(frame_rate / sample_rate)
    if frame_interval == 0:
        frame_interval = 1

    embeddings = []
    frame_count = 0
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        if frame_count % frame_interval == 0:
            # Convert frame to PIL Image
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_image = Image.fromarray(frame_rgb)

            embedding = model.encode(pil_image)
            embeddings.append(embedding)

        frame_count += 1

    cap.release()

    if not embeddings:
        return []

    # Average the embeddings of the frames
    avg_embedding = np.mean(embeddings, axis=0)
    return avg_embedding.tolist()

# --- Public API ---

def add_text(text_content: str, metadata: dict = None):
    """Adds a text document to the collection."""
    embedding = _embed_text(text_content)
    doc_id = f"text_{hash(text_content)}"

    if metadata is None:
        metadata = {}
    metadata['type'] = 'text'

    collection.add(
        ids=[doc_id],
        embeddings=[embedding],
        documents=[text_content],
        metadatas=[metadata]
    )
    return doc_id

def add_image(image_path: str, metadata: dict = None):
    """Adds an image document to the collection."""
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image file not found: {image_path}")

    embedding = _embed_image(image_path)
    doc_id = f"image_{os.path.basename(image_path)}_{hash(image_path)}"

    if metadata is None:
        metadata = {}
    metadata['type'] = 'image'
    metadata['path'] = image_path

    collection.add(
        ids=[doc_id],
        embeddings=[embedding],
        # We can store the path in the document field for images
        documents=[f"Image file at path: {image_path}"],
        metadatas=[metadata]
    )
    return doc_id

def add_video(video_path: str, metadata: dict = None):
    """Adds a video document to the collection."""
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video file not found: {video_path}")

    embedding = _embed_video(video_path)
    if not embedding:
        print(f"Could not generate embedding for video {video_path}")
        return None

    doc_id = f"video_{os.path.basename(video_path)}_{hash(video_path)}"

    if metadata is None:
        metadata = {}
    metadata['type'] = 'video'
    metadata['path'] = video_path

    collection.add(
        ids=[doc_id],
        embeddings=[embedding],
        documents=[f"Video file at path: {video_path}"],
        metadatas=[metadata]
    )
    return doc_id

def search(query: str, n_results: int = 5):
    """Searches the collection for a given query."""
    query_embedding = _embed_text(query)
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=n_results
    )
    return results

def delete_data(doc_id: str):
    """Deletes a document from the collection by its ID."""
    collection.delete(ids=[doc_id])

def add_pdf(file_path: str, metadata: dict = None):
    """Extracts text from a PDF, embeds it, and adds it to the collection."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"PDF file not found: {file_path}")

    doc = fitz.open(file_path)
    text_content = ""
    for page in doc:
        text_content += page.get_text()
    doc.close()

    if not text_content.strip():
        return None # Or raise an error if empty PDFs are not allowed

    embedding = _embed_text(text_content)
    doc_id = f"pdf_{os.path.basename(file_path)}_{hash(file_path)}"

    if metadata is None:
        metadata = {}
    metadata['type'] = 'pdf'
    metadata['path'] = file_path

    collection.add(
        ids=[doc_id],
        embeddings=[embedding],
        documents=[text_content],
        metadatas=[metadata]
    )
    return doc_id

def add_doc(file_path: str, metadata: dict = None):
    """Extracts text from a DOCX file, embeds it, and adds it to the collection."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"DOCX file not found: {file_path}")

    doc = docx.Document(file_path)
    text_content = "\n".join([para.text for para in doc.paragraphs])

    if not text_content.strip():
        return None

    embedding = _embed_text(text_content)
    doc_id = f"doc_{os.path.basename(file_path)}_{hash(file_path)}"

    if metadata is None:
        metadata = {}
    metadata['type'] = 'doc'
    metadata['path'] = file_path

    collection.add(
        ids=[doc_id],
        embeddings=[embedding],
        documents=[text_content],
        metadatas=[metadata]
    )
    return doc_id
