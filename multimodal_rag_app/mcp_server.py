from mcp.server.fastmcp import FastMCP
from typing import Dict, Any
import database as db

# This will initialize the DB and load the model.
# It might be slow on the first run.
mcp_server = FastMCP(name="Multimodal RAG Server")

@mcp_server.tool()
def add_file_data(data_type: str, file_path: str) -> str:
    """
    Adds file-based data (image or video) to the vector database from a given path.
    This tool is intended to be called by the application backend after a file has been uploaded and saved.
    :param data_type: Type of data, can be 'image' or 'video'.
    :param file_path: The path to the saved file.
    """
    try:
        if data_type == 'image':
            doc_id = db.add_image(file_path)
            return f"Image added with ID: {doc_id}"
        elif data_type == 'video':
            doc_id = db.add_video(file_path)
            return f"Video added with ID: {doc_id}"
        else:
            return "Error: Invalid data type for files. Must be 'image' or 'video'."
    except FileNotFoundError:
        return f"Error: File not found at {file_path}"
    except Exception as e:
        return f"Error processing file: {e}"

@mcp_server.tool()
def add_text_data(content: str) -> str:
    """
    Adds text data to the vector database.
    :param content: The text content.
    """
    try:
        doc_id = db.add_text(content)
        return f"Text added with ID: {doc_id}"
    except Exception as e:
        return f"Error adding text: {e}"

@mcp_server.resource("rag_search://{query}")
def search_data(query: str) -> Dict[str, Any]:
    """
    Searches for relevant data in the vector database.
    The client (e.g., an LLM) can access this resource by using the URI 'rag_search://<your_query_here>'.
    :param query: The search query.
    """
    try:
        results = db.search(query)
        # The result from chromadb is already a dictionary, which is serializable.
        return results
    except Exception as e:
        return {"error": f"An error occurred during search: {e}"}
