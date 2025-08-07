// This script handles the popup's logic.
document.addEventListener('DOMContentLoaded', () => {
  const highlightBtn = document.getElementById('highlightBtn');
  const underlineBtn = document.getElementById('underlineBtn');
  const editModeToggle = document.getElementById('editModeToggle');
  const addNoteBtn = document.getElementById('addNoteBtn');

  // --- Sync UI with content script state on popup open ---
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'getEditModeState' }, (response) => {
        if (chrome.runtime.lastError) {
          console.log("Could not establish connection. Content script may not be injected yet.");
        } else {
          if (response && response.isEditMode) {
            editModeToggle.checked = true;
          }
        }
      });
    }
  });

  // --- Event Listeners ---
  highlightBtn.addEventListener('click', () => {
    sendMessageToContentScript({ action: 'highlight' });
  });

  underlineBtn.addEventListener('click', () => {
    sendMessageToContentScript({ action: 'underline' });
  });

  editModeToggle.addEventListener('change', (event) => {
    sendMessageToContentScript({ action: 'setEditMode', enabled: event.target.checked });
  });

  addNoteBtn.addEventListener('click', () => {
    sendMessageToContentScript({ action: 'enterNoteMode' });
    window.close(); // Close the popup so the user can see the page
  });


  // --- Helper Function ---
  function sendMessageToContentScript(message) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
          if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError.message);
          } else {
            // Optional: handle response
          }
        });
      } else {
        console.error("No active tab found.");
      }
    });
  }
});
