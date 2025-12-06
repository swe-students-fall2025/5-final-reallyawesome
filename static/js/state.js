/**
 * State management
 * State Management Module
 */

const state = {
    currentCommunity: null,
    currentCategory: 'all',
    listings: [],
    communities: [],
    currentUser: null,
    searchHistory: [],
    userListings: [],
    userFavorites: [],
    favoriteIds: []
};

const API_BASE_URL = '/api';

/**
 * 
 */
function updateCurrentCommunity(communityId) {
    state.currentCommunity = communityId;
}

/**
 * 
 */
function updateCurrentCategory(category) {
    state.currentCategory = category;
}

/**
 * Listings
 */
function updateListings(listings) {
    state.listings = listings;
}

/**
 * 
 */
function updateUserListings(listings) {
    state.userListings = listings;
}

/**
 * Favorite
 */
function updateUserFavorites(favorites) {
    state.userFavorites = favorites;
}

/**
 * FavoriteID
 */
function updateFavoriteIds(ids) {
    state.favoriteIds = Array.isArray(ids) ? ids : [];
}

/**
 * 
 */
function updateCommunities(communities) {
    state.communities = communities;
}

/**
 * Status
 */
function getState() {
    return state;
}

/**
 * 
 */
function getCurrentUser() {
    return state.currentUser;
}

/**
 * Login
 */
function isAuthenticated() {
    return !!(state.currentUser && state.currentUser.id);
}

/**
 * 
 */
function setCurrentUser(user) {
    state.currentUser = user || null;

    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        try {
            if (user) {
                localStorage.setItem('currentUser', JSON.stringify(user));
            } else {
                localStorage.removeItem('currentUser');
            }
        } catch (error) {
            console.error(':', error);
        }
    }
}

/**
 * 
 */
function hydrateCurrentUserFromStorage() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return;
    }

    try {
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            state.currentUser = JSON.parse(storedUser);
        } else {
            state.currentUser = null;
        }
    } catch (error) {
        console.error(':', error);
        state.currentUser = null;
    }
}

/**
 * 
 */
function addToSearchHistory(query) {
    if (!query || query.trim().length === 0) return;
    
    state.searchHistory = state.searchHistory.filter(item => item !== query);
    state.searchHistory.unshift(query);
    state.searchHistory = state.searchHistory.slice(0, 10);
    
    //  localStorage
    try {
        localStorage.setItem('searchHistory', JSON.stringify(state.searchHistory));
    } catch (error) {
        console.error(':', error);
    }
}

/**
 * 
 */
function loadSearchHistory() {
    try {
        const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
        state.searchHistory = history;
    } catch (error) {
        console.error(':', error);
        state.searchHistory = [];
    }
}

/**
 * 
 */
function clearSearchHistoryState() {
    state.searchHistory = [];
    try {
        localStorage.removeItem('searchHistory');
    } catch (error) {
        console.error(':', error);
    }
}

// 
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        state,
        updateCurrentCommunity,
        updateCurrentCategory,
        updateListings,
        updateUserListings,
        updateUserFavorites,
        updateFavoriteIds,
        updateCommunities,
        getState,
        getCurrentUser,
        isAuthenticated,
        setCurrentUser,
        hydrateCurrentUserFromStorage,
        addToSearchHistory,
        loadSearchHistory,
        clearSearchHistoryState
    };
}

if (typeof window !== 'undefined') {
    hydrateCurrentUserFromStorage();
}
