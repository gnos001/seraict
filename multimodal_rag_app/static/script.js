document.addEventListener('DOMContentLoaded', () => {
    const dataTypeSelect = document.getElementById('data-type');
    const textInputSection = document.getElementById('text-input-section');
    const fileInputSection = document.getElementById('file-input-section');
    const uploadForm = document.getElementById('upload-form');
    const uploadStatus = document.getElementById('upload-status');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatBox = document.getElementById('chat-box');
    const chatStatus = document.getElementById('chat-status');

    // Toggle form inputs based on data type
    dataTypeSelect.addEventListener('change', () => {
        if (dataTypeSelect.value === 'text') {
            textInputSection.style.display = 'block';
            fileInputSection.style.display = 'none';
        } else {
            textInputSection.style.display = 'none';
            fileInputSection.style.display = 'block';
        }
    });

    // Handle data upload
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        uploadStatus.textContent = 'Uploading...';

        const formData = new FormData();
        formData.append('data_type', dataTypeSelect.value);

        if (dataTypeSelect.value === 'text') {
            formData.append('text_content', document.getElementById('text-content').value);
        } else {
            const fileInput = document.getElementById('file');
            if (fileInput.files.length > 0) {
                formData.append('file', fileInput.files[0]);
            } else {
                uploadStatus.textContent = 'Please select a file.';
                return;
            }
        }

        try {
            const response = await fetch('/upload/', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            if (response.ok) {
                // Create a container for the status message and delete button
                const statusContainer = document.createElement('div');
                statusContainer.innerHTML = `
                    <span>Success: ${result.message} (ID: ${result.doc_id})</span>
                    <button class="delete-btn" data-doc-id="${result.doc_id}">Delete</button>
                `;
                uploadStatus.innerHTML = ''; // Clear previous status
                uploadStatus.appendChild(statusContainer);

                // Add listener to the new delete button
                statusContainer.querySelector('.delete-btn').addEventListener('click', handleDelete);
            } else {
                uploadStatus.textContent = `Error: ${result.detail}`;
            }
        } catch (error) {
            uploadStatus.textContent = `An error occurred: ${error.message}`;
        }
    });

    // Handle delete button click
    async function handleDelete(e) {
        const docId = e.target.dataset.docId;
        if (!docId) return;

        if (!confirm(`Are you sure you want to delete document ${docId}?`)) {
            return;
        }

        e.target.textContent = 'Deleting...';
        e.target.disabled = true;

        try {
            const response = await fetch(`/delete/${docId}`, {
                method: 'DELETE',
            });

            const result = await response.json();

            if (response.ok) {
                e.target.parentElement.innerHTML = `<span>${result.message}</span>`;
            } else {
                e.target.parentElement.innerHTML = `<span>Error: ${result.detail}</span>`;
            }
        } catch (error) {
            e.target.parentElement.innerHTML = `<span>An error occurred: ${error.message}</span>`;
        }
    }

    // Handle chat submission
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const query = chatInput.value.trim();
        if (!query) return;

        appendMessage(query, 'user');
        chatInput.value = '';
        chatStatus.textContent = 'Thinking...';

        try {
            const response = await fetch('/chat/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query: query }),
            });

            const result = await response.json();
            chatStatus.textContent = '';

            if (response.ok) {
                appendMessage(result.response, 'bot');
            } else {
                appendMessage(`Error: ${result.detail}`, 'bot');
            }
        } catch (error) {
            chatStatus.textContent = '';
            appendMessage(`An error occurred: ${error.message}`, 'bot');
        }
    });

    function appendMessage(text, sender) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', `${sender}-message`);
        messageElement.textContent = text;
        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight;
    }
});
