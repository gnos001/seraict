// This script handles the popup's logic.
document.addEventListener('DOMContentLoaded', () => {
  const highlightBtn = document.getElementById('highlightBtn');
  const underlineBtn = document.getElementById('underlineBtn');

  highlightBtn.addEventListener('click', () => {
    sendMessageToContentScript({ action: 'highlight' });
  });

  underlineBtn.addEventListener('click', () => {
    sendMessageToContentScript({ action: 'underline' });
  });

  function sendMessageToContentScript(message) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
          if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError.message);
          } else {
            console.log(response.status);
          }
        });
      } else {
        console.error("No active tab found.");
      }
    });
  }
});
