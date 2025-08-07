// This is the background script.
// It will handle storage.
console.log("Background script loaded.");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveHighlight') {
    const { highlight } = request;
    if (!highlight || !highlight.url) {
      console.error('Invalid highlight data received');
      sendResponse({ status: 'error', message: 'Invalid data' });
      return true; // Keep the message channel open for the response
    }

    const key = highlight.url;
    chrome.storage.local.get([key], (result) => {
      const highlights = result[key] || [];
      highlights.push(highlight);

      chrome.storage.local.set({ [key]: highlights }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error saving highlight:', chrome.runtime.lastError.message);
          sendResponse({ status: 'error', message: chrome.runtime.lastError.message });
        } else {
          console.log('Highlight saved for url:', key);
          sendResponse({ status: 'success' });
        }
      });
    });

    return true; // Indicates that the response is sent asynchronously
  } else if (request.action === 'getHighlights') {
    const { url } = request;
    if (!url) {
      sendResponse({ highlights: [] });
      return;
    }
    chrome.storage.local.get([url], (result) => {
      if (chrome.runtime.lastError) {
        console.error('Error getting highlights:', chrome.runtime.lastError.message);
        sendResponse({ highlights: [] });
      } else {
        sendResponse({ highlights: result[url] || [] });
      }
    });
    return true; // Indicates that the response is sent asynchronously
  }
});
