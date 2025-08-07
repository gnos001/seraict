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
    id: `highlight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
  styleRange(range, highlightInfo.action, highlightInfo.id);

  // Save the highlight
  chrome.runtime.sendMessage({ action: 'saveHighlight', highlight: highlightInfo }, response => {
    if (chrome.runtime.lastError) console.error(chrome.runtime.lastError.message);
    else console.log('Highlight saved:', response.status);
  });

  selection.removeAllRanges();
}

function styleRange(range, action, id) {
    const span = document.createElement('span');
    span.className = action === 'highlight' ? 'text-highlighter-highlight' : 'text-highlighter-underline';
    span.dataset.highlightId = id; // Add this line
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

        styleRange(range, highlight.action, highlight.id);

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

// --- Deletion and Modification UI ---

let activeMenu = null;

function showActionMenu(spanElement) {
    // Remove any existing menu
    if (activeMenu) {
        activeMenu.remove();
    }

    const rect = spanElement.getBoundingClientRect();

    activeMenu = document.createElement('div');
    activeMenu.className = 'text-highlighter-action-menu';
    activeMenu.style.position = 'absolute';
    activeMenu.style.top = `${window.scrollY + rect.bottom}px`;
    activeMenu.style.left = `${window.scrollX + rect.left}px`;
    activeMenu.style.zIndex = 10000;

    // Delete Button
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '삭제';
    deleteBtn.onclick = () => {
        const highlightId = spanElement.dataset.highlightId;

        // Unwrap the span
        spanElement.outerHTML = spanElement.innerHTML;

        // Remove from storage
        chrome.runtime.sendMessage({ action: 'deleteHighlight', url: window.location.href, highlightId });

        activeMenu.remove();
        activeMenu = null;
    };
    activeMenu.appendChild(deleteBtn);

    // Modify Button
    const modifyBtn = document.createElement('button');
    modifyBtn.textContent = '스타일 변경';
    modifyBtn.onclick = () => {
        const highlightId = spanElement.dataset.highlightId;
        const currentAction = spanElement.classList.contains('text-highlighter-highlight') ? 'highlight' : 'underline';
        const newAction = currentAction === 'highlight' ? 'underline' : 'highlight';

        // Update class on page
        spanElement.className = `text-highlighter-${newAction}`;

        // Update in storage
        chrome.runtime.sendMessage({ action: 'updateHighlight', url: window.location.href, highlightId, newAction });

        activeMenu.remove();
        activeMenu = null;
    };
    activeMenu.appendChild(modifyBtn);

    document.body.appendChild(activeMenu);
}

// Global click listener
document.addEventListener('click', (event) => {
    const target = event.target;

    // Check if a highlight span was clicked
    if (target.dataset.highlightId) {
        showActionMenu(target);
        event.stopPropagation(); // Prevent the click from immediately closing the menu
        return;
    }

    // Check if the click was inside the action menu
    if (activeMenu && activeMenu.contains(target)) {
        // Click was inside the menu, do nothing
        return;
    }

    // Click was outside, so hide any active menu
    if (activeMenu) {
        activeMenu.remove();
        activeMenu = null;
    }
});
