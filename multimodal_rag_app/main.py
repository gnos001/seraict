import uvicorn
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from mcp_server import mcp_server
import database as db
import os
import shutil
import tempfile
from pydantic import BaseModel
import anthropic

# --- Configuration ---
# In a real application, get this from environment variables
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "YOUR_CLAUDE_API_KEY")
CLAUDE_MODEL = "claude-3-5-sonnet-20240620" # User requested a model that is not available yet, using the latest one.

# Create a temporary directory for uploads
UPLOAD_DIR = tempfile.mkdtemp(prefix="rag_uploads_")

# --- FastAPI App Initialization ---
app = FastAPI(title="Multimodal RAG API")

# Mount the MCP server
# Note: The MCP server provides a standardized way for other tools (e.g., Claude Desktop)
# to interact with our data. The FastAPI endpoints provide a web-friendly API.
app.mount("/mcp", mcp_server.streamable_http_app())

# --- Pydantic Models ---
class ChatMessage(BaseModel):
    query: str

class UploadResponse(BaseModel):
    message: str
    doc_id: str | None = None

# --- API Endpoints ---

# --- Static Files and Root Endpoint ---
# This mounts the 'static' directory to be served at the '/static' path.
# The working directory is expected to be 'multimodal_rag_app'.
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def read_index():
    # Return the main HTML file for the root URL
    return FileResponse('static/index.html')

@app.post("/upload/", response_model=UploadResponse)
async def upload_data(data_type: str = Form(...), text_content: str = Form(None), file: UploadFile = File(None)):
    """
    Uploads data to the RAG system.
    - For text: provide data_type='text' and text_content.
    - For files: provide data_type='image' or data_type='video' and the file.
    """
    if data_type == 'text':
        if not text_content:
            raise HTTPException(status_code=400, detail="text_content is required for data_type 'text'")
        doc_id = db.add_text(text_content)
        return {"message": "Text content added successfully.", "doc_id": doc_id}

    elif data_type in ['image', 'video']:
        if not file:
            raise HTTPException(status_code=400, detail="A file is required for data_type 'image' or 'video'")

        try:
            # Save the uploaded file temporarily
            file_path = os.path.join(UPLOAD_DIR, file.filename)
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            # Add the file to the database
            if data_type == 'image':
                doc_id = db.add_image(file_path)
            else: # video
                doc_id = db.add_video(file_path)

            # The file can be removed after processing if no longer needed
            # os.remove(file_path)

            return {"message": f"{data_type.capitalize()} uploaded and processed.", "doc_id": doc_id}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to process file: {e}")
        finally:
            file.file.close()

    else:
        raise HTTPException(status_code=400, detail="Invalid data_type. Must be 'text', 'image', or 'video'.")


@app.post("/chat/")
async def chat_with_rag(message: ChatMessage):
    """
    Handles chat requests, incorporating RAG from the vector database.
    """
    if not ANTHROPIC_API_KEY or ANTHROPIC_API_KEY == "YOUR_CLAUDE_API_KEY":
        raise HTTPException(status_code=500, detail="Anthropic API key is not configured.")

    try:
        # 1. Search for relevant context in Chroma DB
        search_results = db.search(query=message.query, n_results=3)

        context_str = "No relevant context found."
        if search_results and search_results['documents'] and search_results['documents'][0]:
            context_documents = search_results['documents'][0]
            context_str = "\n---\n".join(context_documents)

        # 2. Construct the prompt for Claude
        prompt = f"""You are a helpful AI assistant. Use the following context to answer the user's question.
If the context is not relevant, answer the question based on your own knowledge.

Context:
---
{context_str}
---

User Question: {message.query}
"""

        # 3. Call the Anthropic API
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=1024,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )

        return {"response": response.content[0].text}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred during chat processing: {e}")

# --- Main Execution ---
if __name__ == "__main__":
    # Note: Uvicorn should be run from the command line for production.
    # e.g., `uvicorn main:app --reload`
    print(f"Uploads will be saved to: {UPLOAD_DIR}")
    uvicorn.run(app, host="0.0.0.0", port=8000)
