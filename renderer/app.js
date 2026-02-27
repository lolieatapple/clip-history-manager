// Application State
let clipboardHistory = [];
let currentContent = null;
let currentContentType = null;
let memoryUsage = 0;
let searchTerm = '';
let filterType = 'all';
let selectedIndex = -1;

// DOM Elements
const elements = {
    currentContent: document.getElementById('currentContent'),
    historyList: document.getElementById('historyList'),
    memoryUsage: document.getElementById('memoryUsage'),
    historyCount: document.getElementById('historyCount'),
    searchInput: document.getElementById('searchInput'),
    clearSearchBtn: document.getElementById('clearSearchBtn'),
    clearCurrentBtn: document.getElementById('clearCurrentBtn'),
    clearAllBtn: document.getElementById('clearAllBtn'),
    refreshBtn: document.getElementById('refreshBtn'),
    confirmModal: document.getElementById('confirmModal'),
    confirmMessage: document.getElementById('confirmMessage'),
    confirmCancel: document.getElementById('confirmCancel'),
    confirmOk: document.getElementById('confirmOk'),
    toastContainer: document.getElementById('toastContainer')
};

// Utility Functions
function formatMemory(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString();
}

function truncateText(text, maxLength = 100) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// Toast Notifications
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = type === 'success' ? 'fas fa-check-circle' :
                 type === 'error' ? 'fas fa-exclamation-circle' :
                 type === 'warning' ? 'fas fa-exclamation-triangle' :
                 'fas fa-info-circle';

    toast.innerHTML = `
        <i class="${icon}"></i>
        <span>${message}</span>
    `;

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, duration);
}

// Modal Functions
function showModal(message, onConfirm) {
    elements.confirmMessage.textContent = message;
    elements.confirmModal.classList.add('show');

    const confirmHandler = () => {
        onConfirm();
        hideModal();
    };

    const cancelHandler = () => {
        hideModal();
    };

    elements.confirmOk.onclick = confirmHandler;
    elements.confirmCancel.onclick = cancelHandler;

    // Close on outside click
    elements.confirmModal.onclick = (e) => {
        if (e.target === elements.confirmModal) {
            hideModal();
        }
    };
}

function hideModal() {
    elements.confirmModal.classList.remove('show');
    elements.confirmOk.onclick = null;
    elements.confirmCancel.onclick = null;
    elements.confirmModal.onclick = null;
}

// Get filtered and sorted history
function getFilteredHistory() {
    // Sort: pinned first, then by timestamp descending within each group
    const sorted = [...clipboardHistory].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.timestamp) - new Date(a.timestamp);
    });

    return sorted.filter(item => {
        // Type filter
        if (filterType !== 'all' && item.type !== filterType) return false;
        // Search filter
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        if (item.type === 'text') {
            return item.content.toLowerCase().includes(searchLower);
        }
        return false;
    });
}

// Render Functions
function renderCurrentContent() {
    if (!currentContent || !currentContentType) {
        elements.currentContent.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clipboard"></i>
                <p>Clipboard is empty</p>
            </div>
        `;
        return;
    }

    if (currentContentType === 'text') {
        elements.currentContent.innerHTML = `
            <div class="text-content">${escapeHtml(currentContent)}</div>
        `;
    } else if (currentContentType === 'image') {
        elements.currentContent.innerHTML = `
            <img class="image-content" src="${currentContent}" alt="Clipboard image">
        `;
    }
}

function renderHistoryList() {
    const filteredHistory = getFilteredHistory();
    selectedIndex = -1;

    elements.historyCount.textContent = `${filteredHistory.length} item${filteredHistory.length !== 1 ? 's' : ''}`;

    if (filteredHistory.length === 0) {
        const isEmptyDueToFilter = (searchTerm || filterType !== 'all') && clipboardHistory.length > 0;
        elements.historyList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-${isEmptyDueToFilter ? 'search' : 'history'}"></i>
                <h3>${isEmptyDueToFilter ? 'No matches found' : 'No history yet'}</h3>
                <p>${isEmptyDueToFilter ? 'Try a different search term or filter' : 'Copy something to get started!'}</p>
            </div>
        `;
        return;
    }

    elements.historyList.innerHTML = filteredHistory.map((item, index) => `
        <div class="history-item${item.pinned ? ' pinned' : ''}" data-id="${item.id}" data-index="${index}" onclick="handleHistoryItemClick(${item.id})">
            <div class="item-index-badge">${index + 1}</div>
            <div class="item-content">
                ${item.type === 'text' ? `
                    <div class="item-preview item-text">${escapeHtml(truncateText(item.content, 150))}</div>
                ` : `
                    <img class="item-image" src="${item.content}" alt="Clipboard image">
                `}
                <div class="item-meta">
                    ${item.pinned ? '<i class="fas fa-thumbtack" style="color: #667eea;"></i>' : ''}
                    <i class="fas fa-clock"></i>
                    <span>${formatTimestamp(item.timestamp)}</span>
                    <span>&bull;</span>
                    <span>${formatMemory(item.size)}</span>
                </div>
            </div>
            <div class="item-actions" onclick="event.stopPropagation()">
                <button class="action-btn pin${item.pinned ? ' active' : ''}" title="${item.pinned ? 'Unpin' : 'Pin'}" onclick="togglePinItem(${item.id})">
                    <i class="fas fa-thumbtack"></i>
                </button>
                <button class="action-btn copy" title="Copy to clipboard" onclick="copyToClipboard(${item.id})">
                    <i class="fas fa-copy"></i>
                </button>
                <button class="action-btn delete" title="Delete" onclick="deleteHistoryItem(${item.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function updateStats() {
    elements.memoryUsage.textContent = formatMemory(memoryUsage);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Keyboard navigation helpers
function updateSelection(newIndex) {
    const filteredHistory = getFilteredHistory();
    if (filteredHistory.length === 0) return;

    // Clamp index
    if (newIndex < 0) newIndex = 0;
    if (newIndex >= filteredHistory.length) newIndex = filteredHistory.length - 1;

    // Remove previous selection
    const prevSelected = elements.historyList.querySelector('.history-item.selected');
    if (prevSelected) prevSelected.classList.remove('selected');

    selectedIndex = newIndex;

    // Add selection to new item
    const items = elements.historyList.querySelectorAll('.history-item');
    if (items[selectedIndex]) {
        items[selectedIndex].classList.add('selected');
        items[selectedIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}

async function selectAndCopy(index) {
    const filteredHistory = getFilteredHistory();
    if (index < 0 || index >= filteredHistory.length) return;

    const item = filteredHistory[index];
    try {
        const result = await window.electronAPI.copyToClipboard(item.content, item.type);
        if (result.success) {
            showToast('Copied to clipboard!', 'success', 1500);
            currentContent = item.content;
            currentContentType = item.type;
            renderCurrentContent();
            await window.electronAPI.hideWindow();
        }
    } catch (error) {
        console.error('Error copying to clipboard:', error);
    }
}

// Event Handlers
async function loadClipboardHistory() {
    try {
        const result = await window.electronAPI.getClipboardHistory();
        clipboardHistory = result.history || [];

        // Set current content from last item if available
        if (clipboardHistory.length > 0) {
            currentContent = clipboardHistory[0].content;
            currentContentType = clipboardHistory[0].type;
        } else {
            currentContent = null;
            currentContentType = null;
        }

        memoryUsage = result.memoryUsage || 0;

        renderCurrentContent();
        renderHistoryList();
        updateStats();
    } catch (error) {
        console.error('Error loading clipboard history:', error);
        showToast('Error loading clipboard history', 'error');
    }
}

async function handleHistoryItemClick(itemId) {
    const item = clipboardHistory.find(h => h.id === itemId);
    if (!item) return;

    try {
        const result = await window.electronAPI.copyToClipboard(item.content, item.type);
        if (result.success) {
            showToast('Copied to clipboard!', 'success');
            currentContent = item.content;
            currentContentType = item.type;
            renderCurrentContent();
        } else {
            showToast('Failed to copy to clipboard', 'error');
        }
    } catch (error) {
        console.error('Error copying to clipboard:', error);
        showToast('Error copying to clipboard', 'error');
    }
}

async function copyToClipboard(itemId) {
    const item = clipboardHistory.find(h => h.id === itemId);
    if (!item) return;

    try {
        const result = await window.electronAPI.copyToClipboard(item.content, item.type);
        if (result.success) {
            showToast('Copied to clipboard!', 'success');
            currentContent = item.content;
            currentContentType = item.type;
            renderCurrentContent();
        } else {
            showToast('Failed to copy to clipboard', 'error');
        }
    } catch (error) {
        console.error('Error copying to clipboard:', error);
        showToast('Error copying to clipboard', 'error');
    }
}

async function togglePinItem(itemId) {
    try {
        const result = await window.electronAPI.togglePinItem(itemId);
        if (result.success) {
            clipboardHistory = result.history;
            memoryUsage = result.memoryUsage;
            renderHistoryList();
            updateStats();
            const item = clipboardHistory.find(h => h.id === itemId);
            showToast(item && item.pinned ? 'Item pinned' : 'Item unpinned', 'success');
        }
    } catch (error) {
        console.error('Error toggling pin:', error);
        showToast('Error toggling pin', 'error');
    }
}

async function clearCurrentClipboard() {
    showModal('Are you sure you want to clear the current clipboard?', async () => {
        try {
            const result = await window.electronAPI.clearClipboard();
            if (result.success) {
                currentContent = null;
                currentContentType = null;
                renderCurrentContent();
                showToast('Clipboard cleared', 'success');
            } else {
                showToast('Failed to clear clipboard', 'error');
            }
        } catch (error) {
            console.error('Error clearing clipboard:', error);
            showToast('Error clearing clipboard', 'error');
        }
    });
}

async function clearAllHistory() {
    showModal('Are you sure you want to clear all clipboard history? This action cannot be undone.', async () => {
        try {
            const result = await window.electronAPI.clearHistory();
            if (result.success) {
                clipboardHistory = [];
                currentContent = null;
                currentContentType = null;
                memoryUsage = result.memoryUsage;

                renderCurrentContent();
                renderHistoryList();
                updateStats();
                showToast('History cleared', 'success');
            }
        } catch (error) {
            console.error('Error clearing history:', error);
            showToast('Error clearing history', 'error');
        }
    });
}

async function deleteHistoryItem(itemId) {
    const item = clipboardHistory.find(h => h.id === itemId);
    if (!item) return;

    const preview = item.type === 'text' ? truncateText(item.content, 50) : 'Image';
    showModal(`Are you sure you want to delete this ${item.type}: "${preview}"?`, async () => {
        try {
            const result = await window.electronAPI.deleteHistoryItem(itemId);
            if (result.success) {
                clipboardHistory = result.history;
                memoryUsage = result.memoryUsage;

                renderHistoryList();
                updateStats();
                showToast('Item deleted', 'success');
            }
        } catch (error) {
            console.error('Error deleting item:', error);
            showToast('Error deleting item', 'error');
        }
    });
}

function handleSearch() {
    searchTerm = elements.searchInput.value.trim();
    renderHistoryList();
}

function clearSearch() {
    elements.searchInput.value = '';
    searchTerm = '';
    renderHistoryList();
    elements.searchInput.focus();
}

// Filter button handler
function handleFilterClick(e) {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    const type = btn.dataset.filter;
    if (type === filterType) return;

    filterType = type;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderHistoryList();
}

// Event Listeners
elements.searchInput.addEventListener('input', handleSearch);
elements.clearSearchBtn.addEventListener('click', clearSearch);
elements.clearCurrentBtn.addEventListener('click', clearCurrentClipboard);
elements.clearAllBtn.addEventListener('click', clearAllHistory);
elements.refreshBtn.addEventListener('click', loadClipboardHistory);

// Filter buttons
document.querySelector('.filter-buttons').addEventListener('click', handleFilterClick);

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Don't handle keyboard navigation when search is focused (except for specific keys)
    const isSearchFocused = document.activeElement === elements.searchInput;

    if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
            case 'f':
                e.preventDefault();
                elements.searchInput.focus();
                break;
            case 'r':
                e.preventDefault();
                loadClipboardHistory();
                break;
        }
        return;
    }

    if (e.key === 'Escape') {
        if (elements.confirmModal.classList.contains('show')) {
            hideModal();
        } else if (elements.searchInput.value) {
            clearSearch();
        } else {
            window.electronAPI.hideWindow();
        }
        return;
    }

    // Number keys 1-9: quick select (only when not typing in search)
    if (!isSearchFocused && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        selectAndCopy(index);
        return;
    }

    // Arrow key navigation
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (isSearchFocused) elements.searchInput.blur();
        updateSelection(selectedIndex + 1);
        return;
    }

    if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (isSearchFocused) elements.searchInput.blur();
        if (selectedIndex <= 0) {
            // Go back to search
            selectedIndex = -1;
            const prevSelected = elements.historyList.querySelector('.history-item.selected');
            if (prevSelected) prevSelected.classList.remove('selected');
            elements.searchInput.focus();
        } else {
            updateSelection(selectedIndex - 1);
        }
        return;
    }

    // Enter: confirm selection
    if (e.key === 'Enter' && !isSearchFocused && selectedIndex >= 0) {
        e.preventDefault();
        selectAndCopy(selectedIndex);
        return;
    }
});

// Electron IPC event listeners
window.electronAPI.onClipboardUpdate((event, data) => {
    const isNewItem = data.history.length > clipboardHistory.length;
    clipboardHistory = data.history;
    currentContent = data.currentContent;
    currentContentType = data.contentType || null;
    memoryUsage = data.memoryUsage;

    renderCurrentContent();
    renderHistoryList();
    updateStats();

    // Notify user if new item arrived but is hidden by search filter
    if (isNewItem && (searchTerm || filterType !== 'all')) {
        const newest = clipboardHistory[0];
        if (newest) {
            const isHiddenByType = filterType !== 'all' && newest.type !== filterType;
            const isHiddenBySearch = searchTerm && newest.type === 'text' && !newest.content.toLowerCase().includes(searchTerm.toLowerCase());
            const isHiddenByImageSearch = searchTerm && newest.type === 'image';
            if (isHiddenByType || isHiddenBySearch || isHiddenByImageSearch) {
                showToast(`New clipboard ${newest.type} (hidden by filter)`, 'info');
            }
        }
    }
});

// Window drag and scroll handling
function setupWindowDragAndScroll() {
    const header = document.querySelector('.header');
    const appContainer = document.querySelector('.app-container');

    let isDragging = false;
    let dragReady = false;
    let startX, startY, startLeft, startTop;

    // Handle mouse events for window dragging
    header.addEventListener('mousedown', async (e) => {
        // Only start dragging on left mouse button
        if (e.button !== 0) return;

        // Don't drag if clicking on buttons or interactive elements
        if (e.target.closest('button, input, .memory-usage')) {
            return;
        }

        // Don't drag if modal is open
        if (elements.confirmModal.classList.contains('show')) {
            return;
        }

        startX = e.clientX;
        startY = e.clientY;
        isDragging = true;
        dragReady = false;

        // Get current window position before allowing movement
        try {
            const pos = await window.electronAPI.getWindowPosition();
            startLeft = pos.x;
            startTop = pos.y;
            dragReady = true;
        } catch (error) {
            console.error('Failed to get window position:', error);
            isDragging = false;
        }

        e.preventDefault();
    });

    const onMouseMove = (e) => {
        if (!isDragging || !dragReady) return;

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        window.electronAPI.moveWindow(startLeft + deltaX, startTop + deltaY);
    };

    const onMouseUp = () => {
        isDragging = false;
        dragReady = false;
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    // Prevent text selection during drag
    header.addEventListener('selectstart', (e) => {
        if (isDragging) {
            e.preventDefault();
        }
    });

    // Ensure scrolling works properly
    appContainer.style.overflowY = 'auto';
    appContainer.style.maxHeight = '100vh';
}

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    loadClipboardHistory();
    setupWindowDragAndScroll();

    // Focus search on load
    elements.searchInput.focus();
});

// Cleanup on unload
window.addEventListener('beforeunload', () => {
    window.electronAPI.removeAllListeners();
});
