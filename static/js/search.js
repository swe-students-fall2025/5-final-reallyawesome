/**
 * 
 * Search Functionality Module
 */

let searchTimeout = null;

/**
 * 
 */
async function loadPopularSearches() {
    const tags = [
        'CS-UY 1134', 'MA-UY 1024', 'Python', 'iPad', 'Rental'
    ];
    
    const container = document.getElementById('popularTags');
    if (container) {
        container.innerHTML = UI.renderPopularTags(tags);
    }
}

/**
 * 
 */
function searchByTag(tag) {
    const searchInput = document.getElementById('searchPageInput');
    if (searchInput) {
        searchInput.value = tag;
        toggleSearchClearButton();
    }
    
    addToSearchHistory(tag);
    handleSearchPageInput({ target: { value: tag } });
}

/**
 * Search page
 */
function handleSearchPageInput(event) {
    toggleSearchClearButton();
    clearTimeout(searchTimeout);
    const query = event.target.value.trim();
    
    if (query.length === 0) {
        document.getElementById('searchResultsContainer').style.display = 'none';
        document.getElementById('popularSearchesSection').style.display = 'block';
        document.getElementById('searchHistorySection').style.display = 'block';
        return;
    }
    
    searchTimeout = setTimeout(async () => {
        await searchInSearchPage(query);
    }, 500);
}

/**
 * Search page
 */
async function searchInSearchPage(query) {
    // 
    document.getElementById('popularSearchesSection').style.display = 'none';
    document.getElementById('searchHistorySection').style.display = 'none';

    // Persist query into history for future suggestions
    addToSearchHistory(query);
    renderSearchHistory();
    
    // Container
    const container = document.getElementById('searchResultsContainer');
    const resultsList = document.getElementById('searchResultsList');
    
    container.style.display = 'block';
    resultsList.innerHTML = '<div class="loading">Searching...</div>';
    
    try {
        const results = await API.searchListings(query);
        resultsList.innerHTML = UI.renderSearchResults(results, query);
    } catch (error) {
        console.error(':', error);
        // 
        const currentState = getState();
        const filtered = currentState.listings.filter(l => 
            l.title.toLowerCase().includes(query.toLowerCase())
        );
        resultsList.innerHTML = UI.renderSearchResults(filtered, query);
    }
}

/**
 * Render search history
 */
function renderSearchHistory() {
    loadSearchHistory();
    const currentState = getState();
    const container = document.getElementById('historyTags');
    
    if (container) {
        container.innerHTML = UI.renderSearchHistory(currentState.searchHistory);
    }
}

/**
 * 
 */
function removeFromHistory(term) {
    const currentState = getState();
    currentState.searchHistory = currentState.searchHistory.filter(item => item !== term);
    
    try {
        localStorage.setItem('searchHistory', JSON.stringify(currentState.searchHistory));
    } catch (error) {
        console.error(':', error);
    }
    
    renderSearchHistory();
}

/**
 * 
 */
function clearSearchHistory() {
    clearSearchHistoryState();
    renderSearchHistory();
}

/**
 * Toggle clear button visibility
 */
function toggleSearchClearButton() {
    const input = document.getElementById('searchPageInput');
    const btn = document.getElementById('searchClearBtn');
    if (!input || !btn) return;
    btn.style.display = input.value && input.value.length > 0 ? 'flex' : 'none';
}

/**
 * Clear search input and results state
 */
function clearSearchInput() {
    const input = document.getElementById('searchPageInput');
    if (!input) return;
    input.value = '';
    toggleSearchClearButton();
    handleSearchPageInput({ target: input });
    input.focus();
}
