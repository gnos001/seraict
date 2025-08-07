// This script will be injected into web pages.
// It will handle text selection and highlighting.
console.log("Content script loaded.");

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'highlight' || request.action === 'underline') {
    applyStyle(request.action);
    sendResponse({ status: 'action completed' });
  }
  return true;
});

// --- Helper Functions for XPath ---

function getPathTo(node) {
    if (node.id) return `id("${node.id}")`;
    if (node === document.body) return '/html/body'; // More specific XPath
    if (node === document.documentElement) return '/html';

    let index = 0;
    const siblings = node.parentNode.childNodes;
    for (const sibling of siblings) {
        if (sibling === node) {
            let nodeName = node.nodeName.toLowerCase();
            if (node.nodeType === Node.TEXT_NODE) {
                nodeName = 'text()';
            }
            // The path from parent must be recursive
            const parentPath = getPathTo(node.parentNode);
            // nth-of-type logic for elements, simple index for text nodes
            if(node.nodeType === Node.ELEMENT_NODE) {
                 let typeIndex = 1;
                 let prevSibling = node.previousElementSibling;
                 while(prevSibling) {
                     if(prevSibling.nodeName === node.nodeName) {
                         typeIndex++;
                     }
                     prevSibling = prevSibling.previousElementSibling;
                 }
                 return `${parentPath}/${nodeName}[${typeIndex}]`;
            } else {
                 return `${parentPath}/${nodeName}[${index + 1}]`;
            }
        }
        if (sibling.nodeType === node.nodeType && sibling.nodeName === node.nodeName) {
            index++;
        }
    }
    return null;
}

function getNodeByXPath(path) {
    try {
        const result = document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        return result.singleNodeValue;
    } catch (error) {
        console.error('Error evaluating XPath:', path, error);
        return null;
    }
}

// --- Main Functions ---

function applyStyle(action) {
  const selection = window.getSelection();
  if (!selection.rangeCount || selection.isCollapsed) return;

  const range = selection.getRangeAt(0);
  if (range.toString().trim() === '') return;

  const highlightInfo = {
    url: window.location.href,
    text: range.toString(),
    action: action,
    createdAt: new Date().toISOString(),
    startContainerPath: getPathTo(range.startContainer),
    startOffset: range.startOffset,
    endContainerPath: getPathTo(range.endContainer),
    endOffset: range.endOffset,
  };

  // Visually apply the style immediately
  styleRange(range, action);

  // Save the highlight
  chrome.runtime.sendMessage({ action: 'saveHighlight', highlight: highlightInfo }, response => {
    if (chrome.runtime.lastError) console.error(chrome.runtime.lastError.message);
    else console.log('Highlight saved:', response.status);
  });

  selection.removeAllRanges();
}

function styleRange(range, action) {
    const span = document.createElement('span');
    span.className = action === 'highlight' ? 'text-highlighter-highlight' : 'text-highlighter-underline';
    try {
        range.surroundContents(span);
    } catch (e) {
        span.appendChild(range.extractContents());
        range.insertNode(span);
    }
}

function restoreHighlight(highlight) {
    try {
        const startNode = getNodeByXPath(highlight.startContainerPath);
        const endNode = getNodeByXPath(highlight.endContainerPath);

        if (!startNode || !endNode) {
            console.warn('Could not find start or end node for highlight:', highlight);
            return;
        }

        const range = document.createRange();
        range.setStart(startNode, highlight.startOffset);
        range.setEnd(endNode, highlight.endOffset);

        // Optional: Verify that the text content still matches
        if (range.toString() !== highlight.text) {
            console.warn('Text content has changed, skipping highlight restoration.', {
                saved: highlight.text,
                current: range.toString()
            });
            return;
        }

        styleRange(range, highlight.action);

    } catch (error) {
        console.error('Error restoring highlight:', highlight, error);
    }
}

// --- On Page Load ---

function loadHighlights() {
    chrome.runtime.sendMessage({ action: 'getHighlights', url: window.location.href }, response => {
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError.message);
            return;
        }
        const highlights = response.highlights || [];
        // Sort highlights to apply them in order, although it's not strictly necessary with XPath
        highlights.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        highlights.forEach(restoreHighlight);
    });
}

// Run the restoration logic after the page has fully loaded
if (document.readyState === 'complete') {
    loadHighlights();
} else {
    window.addEventListener('load', loadHighlights);
}
