// Global State
let allNotes = [];
let filteredNotes = [];
let currentFilter = 'all';
let currentSearchQuery = '';

// DOM Elements
const refreshBtn = document.getElementById('refresh-btn');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const exportCsvBtn = document.getElementById('export-csv-btn');
const retryBtn = document.getElementById('retry-btn');
const searchInput = document.getElementById('search-input');
const filterChips = document.querySelectorAll('.filter-chip');
const notesList = document.getElementById('notes-list');
const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const errorMessage = document.getElementById('error-message');
const emptyState = document.getElementById('empty-state');

// Stats Elements
const statTotal = document.getElementById('stat-total');
const statLatest = document.getElementById('stat-latest');
const statLastChecked = document.getElementById('stat-last-checked');
const feedTitle = document.getElementById('feed-title');

// Modal Elements
const tweetModal = document.getElementById('tweet-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelTweetBtn = document.getElementById('cancel-tweet-btn');
const postTweetBtn = document.getElementById('post-tweet-btn');
const tweetTextarea = document.getElementById('tweet-textarea');
const charUsed = document.getElementById('char-used');

// Category Keyword Configs
const CATEGORY_KEYWORDS = {
    deprecation: ['deprecate', 'deprecation', 'deprecated', 'obsolete', 'discontinued', 'no longer', 'sunset'],
    fix: ['fix', 'fixed', 'resolved', 'resolves', 'correct', 'corrected', 'issue', 'bug', 'regression', 'error'],
    feature: ['feature', 'support', 'new', 'introduced', 'introduce', 'add', 'added', 'allow', 'allows', 'support for', 'preview', 'ga', 'general availability'],
    change: ['change', 'changed', 'update', 'updated', 'modify', 'modified', 'behavior', 'now requires', 'default', 'adjust', 'adjusted']
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    fetchReleaseNotes();
    setupEventListeners();
});

// Setup Event Listeners
function setupEventListeners() {
    refreshBtn.addEventListener('click', () => {
        if (!refreshBtn.classList.contains('spinning')) {
            fetchReleaseNotes();
        }
    });
    
    retryBtn.addEventListener('click', fetchReleaseNotes);
    
    // Theme Toggle
    themeToggleBtn.addEventListener('click', toggleTheme);
    
    // Export CSV
    exportCsvBtn.addEventListener('click', exportToCSV);
    
    // Search with simple debounce/input handler
    searchInput.addEventListener('input', (e) => {
        currentSearchQuery = e.target.value.toLowerCase().trim();
        applyFiltersAndSearch();
    });
    
    // Category filter chips
    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilter = chip.dataset.filter;
            applyFiltersAndSearch();
        });
    });
    
    // Modal events
    closeModalBtn.addEventListener('click', closeTweetModal);
    cancelTweetBtn.addEventListener('click', closeTweetModal);
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) closeTweetModal();
    });
    
    // Realtime char counter for textarea
    tweetTextarea.addEventListener('input', () => {
        updateCharCount();
    });
    
    // Post tweet
    postTweetBtn.addEventListener('click', postToTwitter);
    
    // Escape key to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !tweetModal.classList.contains('hidden')) {
            closeTweetModal();
        }
    });
}

// Fetch data from backend API
async function fetchReleaseNotes() {
    showLoading();
    refreshBtn.classList.add('spinning');
    
    try {
        const response = await fetch('/api/release-notes');
        const data = await response.json();
        
        if (data.success) {
            allNotes = data.notes.map(note => {
                const category = categorizeNote(note);
                return { ...note, category };
            });
            
            updateStats(data.feed_title);
            applyFiltersAndSearch();
            showContent();
        } else {
            showError(data.error || 'Server returned an error.');
        }
    } catch (err) {
        showError(err.message || 'Network communication failure.');
    } finally {
        refreshBtn.classList.remove('spinning');
    }
}

// Auto-categorize based on title/content analysis
function categorizeNote(note) {
    const textToScan = `${note.title} ${note.content}`.toLowerCase();
    
    // 1. Deprecations (high priority)
    if (CATEGORY_KEYWORDS.deprecation.some(kw => textToScan.includes(kw))) {
        return 'deprecated';
    }
    // 2. Fixes
    if (CATEGORY_KEYWORDS.fix.some(kw => textToScan.includes(kw))) {
        return 'fixed';
    }
    // 3. New Features
    if (CATEGORY_KEYWORDS.feature.some(kw => textToScan.includes(kw))) {
        return 'new';
    }
    // 4. General Changes
    if (CATEGORY_KEYWORDS.change.some(kw => textToScan.includes(kw))) {
        return 'changed';
    }
    
    return 'general';
}

// Update App Statistics Display
function updateStats(title) {
    feedTitle.textContent = title || 'Google Cloud BigQuery Updates';
    statTotal.textContent = allNotes.length;
    
    // Latest note date
    if (allNotes.length > 0) {
        // Format the date string from the feed (typically like "Wed, 10 Jun 2026 00:00:00 GMT" or ISO)
        const latestDate = allNotes[0].date;
        try {
            const parsed = new Date(latestDate);
            if (!isNaN(parsed.getTime())) {
                statLatest.textContent = parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
            } else {
                statLatest.textContent = latestDate.split(',')[1]?.trim() || latestDate;
            }
        } catch {
            statLatest.textContent = latestDate;
        }
    } else {
        statLatest.textContent = '-';
    }
    
    // Current time
    const now = new Date();
    statLastChecked.textContent = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Apply Category Filter & Search Query
function applyFiltersAndSearch() {
    filteredNotes = allNotes.filter(note => {
        // Category Filter
        const matchesCategory = currentFilter === 'all' || note.category === currentFilter;
        
        // Search Filter
        const matchesSearch = currentSearchQuery === '' || 
            note.title.toLowerCase().includes(currentSearchQuery) || 
            note.content.toLowerCase().includes(currentSearchQuery);
            
        return matchesCategory && matchesSearch;
    });
    
    renderNotesList();
}

// Render the final release note list
function renderNotesList() {
    notesList.innerHTML = '';
    
    if (filteredNotes.length === 0) {
        showEmpty();
        return;
    }
    
    hideStates();
    
    filteredNotes.forEach(note => {
        const card = document.createElement('article');
        card.className = `card note-card category-${note.category}`;
        card.id = `note-${note.id || Math.random().toString(36).substr(2, 9)}`;
        
        // Get category label & badge style
        let badgeText = 'General';
        let badgeClass = 'badge-general';
        
        switch (note.category) {
            case 'new':
                badgeText = 'Feature';
                badgeClass = 'badge-feature';
                break;
            case 'changed':
                badgeText = 'Change';
                badgeClass = 'badge-change';
                break;
            case 'deprecated':
                badgeText = 'Deprecation';
                badgeClass = 'badge-deprecation';
                break;
            case 'fixed':
                badgeText = 'Fix';
                badgeClass = 'badge-fix';
                break;
        }
        
        // Format note published date
        let displayDate = note.date;
        try {
            const parsed = new Date(note.date);
            if (!isNaN(parsed.getTime())) {
                displayDate = parsed.toLocaleDateString(undefined, { 
                    weekday: 'short', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
            }
        } catch (e) {
            // Keep original string if parsing fails
        }
        
        card.innerHTML = `
            <div class="note-card-header">
                <div class="note-title-wrapper">
                    <h3 class="note-title">${escapeHTML(note.title)}</h3>
                    <span class="note-date">${displayDate}</span>
                </div>
                <span class="note-badge ${badgeClass}">${badgeText}</span>
            </div>
            <div class="note-body">
                ${note.content}
            </div>
            <div class="note-actions">
                ${note.link ? `<a href="${note.link}" target="_blank" rel="noopener noreferrer" class="btn-link">
                    <span>View Docs</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M19 19H5V5H12V3H5C3.89 3 3 3.9 3 5V19C3 20.1 3.89 21 5 21H19C20.1 21 21 20.1 21 19V12H19V19ZM14 3V5H17.59L7.76 14.83L9.17 16.24L19 6.41V10H21V3H14Z" fill="currentColor"/>
                    </svg>
                </a>` : ''}
                <button class="btn btn-secondary" onclick="copyNoteToClipboard(${JSON.stringify(note.id || '').replace(/"/g, '&quot;')}, this)">
                    <span class="btn-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </span>
                    <span class="btn-text">Copy</span>
                </button>
                <button class="btn btn-share-tweet" onclick="openTweetComposer(${JSON.stringify(note.id || '').replace(/"/g, '&quot;')})">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    Tweet Update
                </button>
            </div>
        `;
        
        notesList.appendChild(card);
    });
}

// Strip HTML tags helper
function stripHTML(html) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Replace list items with bullet points for readability
    const listItems = tempDiv.querySelectorAll('li');
    listItems.forEach(li => {
        li.textContent = `• ${li.textContent}\n`;
    });
    
    // Return text content
    return tempDiv.textContent || tempDiv.innerText || "";
}

// Escape HTML tags for safe rendering
function escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Open custom Tweet Composer modal
window.openTweetComposer = function(noteId) {
    const note = allNotes.find(n => n.id === noteId || (n.id === '' && !noteId));
    if (!note) return;
    
    // Craft tweet text
    const maxTweetLength = 280;
    const cleanContent = stripHTML(note.content).trim();
    const cleanTitle = note.title.trim();
    
    // Suffix / Hashtags / Link
    const linkSuffix = note.link ? `\n\nDocs: ${note.link}` : '';
    const hashtags = ' #BigQuery #GoogleCloud';
    
    // Base tweet format
    // Title is bold and clear, followed by highlights
    let tweetDraft = `BigQuery Update: ${cleanTitle}\n\n`;
    
    // Calculate remaining character capacity
    // Note: Twitter counts URL length as 23 characters for sharing, regardless of real length
    const twitterLinkLength = note.link ? 23 : 0;
    const overheadText = `BigQuery Update: ${cleanTitle}\n\n\n\n${hashtags}`;
    const overheadLength = overheadText.length + (note.link ? 2 + twitterLinkLength : 0);
    const availableLength = maxTweetLength - overheadLength;
    
    if (cleanContent.length > availableLength) {
        // Truncate content nicely
        const truncated = cleanContent.substring(0, availableLength - 3) + '...';
        tweetDraft += truncated;
    } else {
        tweetDraft += cleanContent;
    }
    
    tweetDraft += `${linkSuffix}${hashtags}`;
    
    // Set text in modal composer
    tweetTextarea.value = tweetDraft;
    
    // Open Modal
    tweetModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Lock background scrolling
    
    // Initial char count update
    updateCharCount();
    
    // Focus and select textarea text
    setTimeout(() => {
        tweetTextarea.focus();
    }, 50);
};

// Close Tweet Modal
function closeTweetModal() {
    tweetModal.classList.add('hidden');
    document.body.style.overflow = ''; // Restore background scrolling
}

// Character counter helper
function updateCharCount() {
    const text = tweetTextarea.value;
    const len = text.length;
    
    charUsed.textContent = len;
    
    // Reset classes
    charUsed.className = '';
    postTweetBtn.disabled = false;
    
    if (len > 280) {
        charUsed.className = 'danger';
        postTweetBtn.disabled = true; // Disable if too long
    } else if (len > 250) {
        charUsed.className = 'warning';
    }
}

// Submit tweet - redirects to Twitter/X web intent URL
function postToTwitter() {
    const tweetText = tweetTextarea.value;
    if (tweetText.length > 280) {
        alert("Your tweet exceeds the 280 character limit.");
        return;
    }
    
    const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(twitterIntentUrl, '_blank', 'noopener,noreferrer');
    closeTweetModal();
}

// UI State Toggles
function showLoading() {
    loadingState.classList.remove('hidden');
    errorState.classList.add('hidden');
    emptyState.classList.add('hidden');
    notesList.classList.add('hidden');
}

function showContent() {
    loadingState.classList.add('hidden');
    errorState.classList.add('hidden');
    emptyState.classList.add('hidden');
    notesList.classList.remove('hidden');
}

function showError(msg) {
    loadingState.classList.add('hidden');
    errorState.classList.remove('hidden');
    errorMessage.textContent = msg;
    emptyState.classList.add('hidden');
    notesList.classList.add('hidden');
}

function showEmpty() {
    loadingState.classList.add('hidden');
    errorState.classList.add('hidden');
    emptyState.classList.remove('hidden');
    notesList.classList.add('hidden');
}

function hideStates() {
    loadingState.classList.add('hidden');
    errorState.classList.add('hidden');
    emptyState.classList.add('hidden');
}

// Theme Toggle Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        document.querySelector('.theme-icon-sun').classList.add('hidden');
        document.querySelector('.theme-icon-moon').classList.remove('hidden');
    }
}

function toggleTheme() {
    const isLight = document.body.classList.toggle('light-theme');
    const sunIcon = document.querySelector('.theme-icon-sun');
    const moonIcon = document.querySelector('.theme-icon-moon');
    
    if (isLight) {
        localStorage.setItem('theme', 'light');
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
    } else {
        localStorage.setItem('theme', 'dark');
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
    }
}

// Copy Note Content to Clipboard
window.copyNoteToClipboard = function(noteId, button) {
    const note = allNotes.find(n => n.id === noteId || (n.id === '' && !noteId));
    if (!note) return;
    
    const cleanContent = stripHTML(note.content).trim();
    const cleanTitle = note.title.trim();
    
    let copyText = `BigQuery Release Note\n`;
    copyText += `=======================\n`;
    copyText += `Title: ${cleanTitle}\n`;
    copyText += `Date: ${note.date}\n`;
    copyText += `Category: ${note.category.toUpperCase()}\n`;
    if (note.link) copyText += `Link: ${note.link}\n`;
    copyText += `-----------------------\n\n`;
    copyText += cleanContent;
    
    navigator.clipboard.writeText(copyText).then(() => {
        const btnText = button.querySelector('.btn-text');
        const btnIcon = button.querySelector('.btn-icon');
        const originalText = btnText.textContent;
        const originalIconHTML = btnIcon.innerHTML;
        
        btnText.textContent = 'Copied!';
        btnIcon.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        `;
        
        setTimeout(() => {
            btnText.textContent = originalText;
            btnIcon.innerHTML = originalIconHTML;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        alert('Failed to copy to clipboard.');
    });
};

// Export Filtered Release Notes to CSV
function exportToCSV() {
    if (filteredNotes.length === 0) {
        alert("No release notes found to export.");
        return;
    }
    
    const headers = ['ID', 'Title', 'Date', 'Category', 'Link', 'Content'];
    
    const escapeCSV = (str) => {
        if (str === null || str === undefined) return '""';
        return '"' + String(str).replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"';
    };
    
    const csvRows = [];
    csvRows.push(headers.join(','));
    
    filteredNotes.forEach(note => {
        const row = [
            escapeCSV(note.id),
            escapeCSV(note.title),
            escapeCSV(note.date),
            escapeCSV(note.category),
            escapeCSV(note.link),
            escapeCSV(stripHTML(note.content).trim())
        ];
        csvRows.push(row.join(','));
    });
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `bigquery_release_notes_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
