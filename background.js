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
  } else if (request.action === 'deleteHighlight') {
    const { url, highlightId } = request;
    chrome.storage.local.get([url], (result) => {
        let highlights = result[url] || [];
        const filteredHighlights = highlights.filter(h => h.id !== highlightId);
        chrome.storage.local.set({ [url]: filteredHighlights }, () => {
            sendResponse({ status: 'success' });
        });
    });
    return true;
  } else if (request.action === 'updateHighlight') {
      const { url, highlightId, newAction } = request;
      chrome.storage.local.get([url], (result) => {
          let highlights = result[url] || [];
          const highlightIndex = highlights.findIndex(h => h.id === highlightId);
          if (highlightIndex !== -1) {
              highlights[highlightIndex].action = newAction;
              chrome.storage.local.set({ [url]: highlights }, () => {
                  sendResponse({ status: 'success', updatedHighlight: highlights[highlightIndex] });
              });
          } else {
              sendResponse({ status: 'error', message: 'Highlight not found' });
          }
      });
      return true;
  }
});
