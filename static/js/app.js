/**
 * Main Application Logic
 *
 * High-level responsibilities:
 * - Initialize app on page load
 * - Load communities, listings, favorites
 * - Handle tab switching (home/search/messages/profile)
 * - Handle listing publishing, favorites, profile modals
 *
 * NOTE: Lower-level utilities live in:
 * - api.js: HTTP requests to backend
 * - state.js: global state management
 * - ui.js: rendering helpers and toast notifications
 * - message.js / contact_seller.js: messaging-specific UI
 */

let defaultNavAuthHTML = null;
let defaultProfileName = null;

/**
 * App entry point. Called on DOMContentLoaded.
 */
async function initApp() {
    try {
        updateNavAuthUI();
        await loadCommunities();

        if (isAuthenticated()) {
            await loadUserFavorites();
        }

        await loadListings();
        loadPopularSearches();
        loadSearchHistory();
        renderSearchHistory();
    } catch (error) {
        console.error('App init failed:', error);
    }
}

/**
 * Load communities from backend and update selector + state.
 * Fallback to mock communities if the API fails.
 */
async function loadCommunities() {
    try {
        const communities = await API.getCommunities();
        updateCommunities(communities);
        UI.renderCommunities(communities, null);
        updateCurrentCommunity(null);
    } catch (error) {
        console.error('Failed to load communities:', error);
        // Fallback to mock communities so UI remains usable
        const mockCommunities = getMockCommunities();
        updateCommunities(mockCommunities);
        UI.renderCommunities(mockCommunities, null);
        updateCurrentCommunity(null);
    }
}

/**
 * Handle community selection changes (dropdown or other UI).
 */
async function selectCommunity(communityId) {
    const normalized = communityId === '' || communityId === null ? null : communityId;
    updateCurrentCommunity(normalized);

    const dropdown = document.getElementById('communitySelector');
    if (dropdown) {
        dropdown.value = normalized === null ? '' : String(normalized);
    }

    await loadListings();
}

/**
 * Load listings for current state (community + category).
 * Falls back to mock listings if API fails or returns empty.
 */
async function loadListings() {
    UI.showLoading('listingsContainer');

    try {
        const currentState = getState();
        const params = { status: 'active' };

        if (currentState.currentCommunity) {
            params.community_id = currentState.currentCommunity;
        }

        if (currentState.currentCategory !== 'all') {
            params.category = currentState.currentCategory;
        }

        const listings = await API.getListings(params);
        const baseList = Array.isArray(listings) ? listings : [];
        const filtered = filterListingsForState(baseList, currentState);
        updateListings(filtered);
        UI.renderListings(filtered);
    } catch (error) {
        console.error('Failed to load listings:', error);
        const filtered = filterListingsForState([], getState());
        updateListings(filtered);
        UI.renderListings(filtered);
    }
}

/**
 * Apply category filter to an existing list based on a snapshot of state.
 */
function filterListingsForState(listings, stateSnapshot) {
    const cat = stateSnapshot.currentCategory;
    if (!listings || !Array.isArray(listings)) return [];
    if (!cat || cat === 'all') return listings;
    const target = cat.toLowerCase();
    return listings.filter(l => (l.category || '').toLowerCase() === target);
}

/**
 * Load listings created by the current user.
 * Optional status filter (e.g., "active", "all").
 */
async function loadMyListings(status = 'active') {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.id) {
        throw new Error('Please log in to view your listings');
    }

    const params = {};
    if (status) {
        params.status = status;
    }

    try {
        const listings = await API.getUserListings(currentUser.id, params);
        updateUserListings(listings);
        return listings;
    } catch (error) {
        console.error('Failed to load my listings:', error);
        throw error;
    }
}

/**
 * Load favorites for the current user and update state.
 */
async function loadUserFavorites() {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.id) {
        updateUserFavorites([]);
        updateFavoriteIds([]);
        return [];
    }

    try {
        const response = await API.getUserFavorites(currentUser.id);
        const favorites = response?.favorites || [];
        const favoriteIds = response?.favorite_ids || response?.favoriteIds || [];
        updateUserFavorites(favorites);
        updateFavoriteIds(favoriteIds);
        return favorites;
    } catch (error) {
        console.error('Failed to load favorites:', error);
        updateUserFavorites([]);
        updateFavoriteIds([]);
        throw error;
    }
}

/**
 * Check whether a listing is currently favorited.
 */
function isListingFavorited(listingId) {
    const currentState = getState();
    return (currentState.favoriteIds || []).includes(listingId);
}

/**
 * Toggle favorite status for a listing for the current user.
 */
async function toggleFavorite(listingId) {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.id) {
        UI.showError('Please log in before adding favorites');
        return;
    }

    const favorited = isListingFavorited(listingId);

    try {
        if (favorited) {
            await API.removeFavorite(currentUser.id, listingId);
            UI.showSuccess('Removed from favorites');
        } else {
            await API.addFavorite({
                user_id: currentUser.id,
                listing_id: listingId
            });
            UI.showSuccess('Added to favorites');
        }

        await loadUserFavorites();
        UI.renderListings(getState().listings);

        refreshDetailFavoriteButton(listingId);
        refreshFavoriteModal();
    } catch (error) {
        console.error('Failed to toggle favorite:', error);
        UI.showError('Failed to update favorite status');
    }
}

/**
 * Allow owners to mark a listing as sold out (soft hide from feeds).
 */
async function markListingSold(listingId) {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.id) {
        UI.showError('Please log in first');
        return;
    }

    try {
        const updated = await API.updateListing(listingId, {
            status: 'sold',
            user_id: currentUser.id
        });

        UI.showSuccess('Listing marked as sold out');

        // Refresh main feed and favorites (My Wish) to remove the sold item.
        await loadListings();
        try {
            await loadUserFavorites();
            refreshFavoriteModal();
        } catch (favError) {
            console.warn('Failed to refresh favorites after marking sold:', favError);
        }

        // If the seller is viewing their listings, refresh the modal contents.
        const listingsModal = document.getElementById('myListingsModal');
        if (listingsModal && listingsModal.classList.contains('active')) {
            try {
                await openMyListingsModal();
            } catch (modalError) {
                console.warn('Failed to refresh my listings modal:', modalError);
            }
        }

        // Update the detail modal to reflect new status without closing it.
        const detailContent = document.getElementById('detailContent');
        if (detailContent && updated) {
            const ownerId = String(updated.user?.id || updated.user_id || '');
            const isOwner = currentUser && String(currentUser.id) === ownerId;
            detailContent.innerHTML = UI.renderListingDetail(updated, { isOwner });
            refreshDetailFavoriteButton(listingId);
        }
    } catch (error) {
        console.error('Failed to mark listing sold:', error);
        UI.showError('Failed to mark as sold out');
    }
}

/**
 * Sync the favorite button in the listing detail modal with current state.
 */
function refreshDetailFavoriteButton(listingId) {
    const button = document.getElementById('favoriteToggleBtn');
    if (!button) return;

    const favorited = isListingFavorited(listingId);
    button.textContent = favorited ? '❤️' : '🤍';
    button.title = favorited ? 'Unfavorite' : 'Favorite';
    button.classList.toggle('favorited', favorited);
}

/**
 * Re-render favorites modal content if it is currently open.
 */
function refreshFavoriteModal() {
    const modal = document.getElementById('myFavoritesModal');
    if (!modal || !modal.classList.contains('active')) {
        return;
    }
    renderFavoritesModalContent();
}

/**
 * Update category filter and reload listings.
 */
async function filterByCategory(category) {
    updateCurrentCategory(category);

    // Highlight active category chip
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.category === category);
    });

    await loadListings();
}

/**
 * Handle dropdown change event for community selector.
 */
function handleCommunityDropdownChange(value) {
    if (value === '') {
        selectCommunity(null);
        return;
    }
    const parsed = parseInt(value, 10);
    if (!Number.isNaN(parsed)) {
        selectCommunity(parsed);
    }
}

/**
 * Show listing detail modal for a given listing ID.
 * Integrates with contactSeller() from contact_seller.js.
 */
async function showListingDetail(listingId) {
    try {
        const listing = await API.getListing(listingId);
        const detailContent = document.getElementById('detailContent');
        const currentUser = getCurrentUser();
        const listingOwnerId = String(listing.user?.id || listing.user_id || listing.user?.user_id || '');
        const isOwner = currentUser && String(currentUser.id) === listingOwnerId;

        if (detailContent) {
            detailContent.innerHTML = UI.renderListingDetail(listing, { isOwner });
            refreshDetailFavoriteButton(listingId);
            const carouselId = `detailCarousel-${String(listing.id).replace(/'/g, "\\'")}`;
            if (listing.images && listing.images.length > 1) {
                carouselInit(carouselId);
            }
            // Delegate detail actions (contact seller) once
            if (!detailContent.dataset.bound) {
                detailContent.addEventListener('click', (event) => {
                    const actionEl = event.target.closest('[data-action]');
                    if (!actionEl) return;
                    const id = actionEl.dataset.listingId;
                    const action = actionEl.dataset.action;
                    if (!id || !action) return;
                    if (action === 'contact-seller') {
                        contactSeller(id);
                    } else if (action === 'mark-sold') {
                        markListingSold(id);
                    }
                });
                detailContent.dataset.bound = '1';
            }
        }

        openModal('detailModal');
    } catch (error) {
        console.error('Failed to load listing details:', error);
        // Fallback: try to use already loaded listings from state
        const currentState = getState();
        const listing = currentState.listings.find(l => l.id === listingId);

        if (listing && document.getElementById('detailContent')) {
            const currentUser = getCurrentUser();
            const listingOwnerId = String(listing.user?.id || listing.user_id || listing.user?.user_id || '');
            const isOwner = currentUser && String(currentUser.id) === listingOwnerId;
            document.getElementById('detailContent').innerHTML = UI.renderListingDetail(listing, { isOwner });
            refreshDetailFavoriteButton(listingId);
            openModal('detailModal');
        } else {
            UI.showError('Failed to load listing details');
        }
    }
}

/**
 * Helper for search results to open the same listing detail modal.
 */
function showListingDetailFromSearch(listingId) {
    showListingDetail(listingId);
}

// ----- Detail image carousel helpers -----

const detailCarouselState = {};

/**
 * Set current slide for a given carousel instance.
 */
function setCarouselSlide(carouselId, index) {
    const container = document.getElementById(carouselId);
    if (!container) return;
    const slides = Array.from(container.querySelectorAll('[data-carousel-item]'));
    if (!slides.length) return;
    const dots = Array.from(container.querySelectorAll('.carousel-dots .dot'));
    const safeIndex = ((index % slides.length) + slides.length) % slides.length;
    slides.forEach((slide, idx) => {
        slide.style.display = idx === safeIndex ? 'flex' : 'none';
    });
    dots.forEach((dot, idx) => {
        dot.classList.toggle('active', idx === safeIndex);
    });
    detailCarouselState[carouselId] = safeIndex;
}

/**
 * Initialize a detail carousel.
 */
function carouselInit(carouselId) {
    detailCarouselState[carouselId] = 0;
    setCarouselSlide(carouselId, 0);
}

/**
 * Go to next slide in a detail carousel.
 */
function carouselNext(carouselId) {
    const current = detailCarouselState[carouselId] || 0;
    setCarouselSlide(carouselId, current + 1);
}

/**
 * Go to previous slide in a detail carousel.
 */
function carouselPrev(carouselId) {
    const current = detailCarouselState[carouselId] || 0;
    setCarouselSlide(carouselId, current - 1);
}

/**
 * Jump to a specific slide in a detail carousel.
 */
function carouselGo(carouselId, index) {
    setCarouselSlide(carouselId, index);
}

// Expose functions for inline handlers
if (typeof window !== 'undefined') {
    window.showListingDetail = showListingDetail;
    window.showListingDetailFromSearch = showListingDetailFromSearch;
    window.carouselNext = carouselNext;
    window.carouselPrev = carouselPrev;
    window.carouselGo = carouselGo;
}

/**
 * Run a global search from the home page search bar.
 */
async function searchListings(query) {
    UI.showLoading('listingsContainer', 'Searching...');

    if (query && query.length > 0) {
        addToSearchHistory(query);
    }

    try {
        const listings = await API.searchListings(query, { status: 'active' });
        updateListings(listings);
        UI.renderListings(listings);
    } catch (error) {
        console.error('Search failed:', error);
        // Fallback to client-side filtering of current listings
        const currentState = getState();
        const filtered = currentState.listings.filter(l =>
            l.title.toLowerCase().includes(query.toLowerCase())
        );
        updateListings(filtered);
        UI.renderListings(filtered);
    }
}

/**
 * Update avatar section in the profile page.
 */
function updateProfileAvatarDisplay(user) {
    const wrapper = document.getElementById('profileAvatar');
    const img = document.getElementById('profileAvatarImg');
    const fallback = document.getElementById('profileAvatarFallback');
    const editBtn = document.getElementById('avatarEditButton');

    if (!wrapper) {
        return;
    }

    const avatarUrl = user && user.avatar ? user.avatar : '';
    if (img) {
        if (avatarUrl) {
            img.src = avatarUrl;
            img.style.display = 'block';
            wrapper.classList.add('has-image');
            if (fallback) fallback.style.display = 'none';
        } else {
            img.removeAttribute('src');
            img.style.display = 'none';
            wrapper.classList.remove('has-image');
            if (fallback) fallback.style.display = 'flex';
        }
    }

    if (fallback) {
        const initial = user && user.nickname
            ? (user.nickname.trim().charAt(0) || '').toUpperCase()
            : '';
        fallback.textContent = initial || '👤';
    }

    const canEdit = typeof isAuthenticated === 'function' && isAuthenticated();
    wrapper.classList.toggle('edit-enabled', canEdit);
    if (editBtn) {
        editBtn.style.display = canEdit ? '' : 'none';
    }
}

/**
 * Trigger hidden file input for avatar upload.
 */
function triggerAvatarUpload() {
    if (typeof isAuthenticated === 'function' && !isAuthenticated()) {
        if (typeof UI !== 'undefined' && UI.showError) {
            UI.showError('Please log in before uploading an avatar');
        }
        return;
    }

    const input = document.getElementById('avatarUploadInput');
    if (input) {
        input.click();
    }
}

/**
 * Handle avatar file selection and upload to backend.
 */
async function handleAvatarFileChange(event) {
    const input = event?.target;
    const file = input?.files?.[0];

    if (!file) {
        return;
    }

    try {
        const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        if (!currentUser || !currentUser.id) {
            if (typeof UI !== 'undefined' && UI.showError) {
                UI.showError('Please log in before uploading an avatar');
            }
            return;
        }

        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            if (typeof UI !== 'undefined' && UI.showError) {
                UI.showError('Avatar file must be under 5MB');
            }
            return;
        }

        // Show local preview immediately
        const previewUrl = URL.createObjectURL(file);
        updateProfileAvatarDisplay({
            ...(currentUser || {}),
            avatar: previewUrl
        });

        const response = await API.uploadAvatar(currentUser.id, file);
        if (response?.user) {
            if (typeof setCurrentUser === 'function') {
                setCurrentUser(response.user);
            }
            updateNavAuthUI();
            if (typeof UI !== 'undefined' && UI.showSuccess) {
                UI.showSuccess('Avatar updated');
            }
        }
    } catch (error) {
        console.error('Avatar upload failed:', error);
        if (typeof UI !== 'undefined' && UI.showError) {
            UI.showError('Avatar upload failed, try again later');
        }
    } finally {
        if (input) {
            input.value = '';
        }
    }
}

/**
 * Update navigation area and profile name based on current user.
 */
function updateNavAuthUI() {
    const navAuth = document.getElementById('navAuthArea');
    if (navAuth && defaultNavAuthHTML === null) {
        defaultNavAuthHTML = navAuth.innerHTML;
    }

    const profileNameEl = document.getElementById('profileName');
    if (profileNameEl && defaultProfileName === null) {
        defaultProfileName = profileNameEl.textContent;
    }

    const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    const nickname = currentUser && currentUser.nickname ? currentUser.nickname : '';

    if (navAuth) {
        if (nickname) {
            navAuth.classList.add('logged-in');
            navAuth.innerHTML = `
                <span class="nav-user-name">👋 ${nickname}</span>
                <button class="logout-btn" onclick="handleLogout()">Log out</button>
            `;
        } else if (defaultNavAuthHTML !== null) {
            navAuth.classList.remove('logged-in');
            navAuth.innerHTML = defaultNavAuthHTML;
        }
    }

    if (profileNameEl) {
        profileNameEl.textContent = nickname || defaultProfileName || 'Guest';
    }

    updateProfileAvatarDisplay(currentUser);
}

/**
 * Handle user logout: clear state, storage and update UI.
 */
function handleLogout() {
    if (typeof setCurrentUser === 'function') {
        setCurrentUser(null);
    }
    if (typeof updateUserListings === 'function') {
        updateUserListings([]);
    }
    if (typeof updateUserFavorites === 'function') {
        updateUserFavorites([]);
    }
    if (typeof updateFavoriteIds === 'function') {
        updateFavoriteIds([]);
    }
    if (typeof UI !== 'undefined' && UI.renderListings) {
        UI.renderListings(getState().listings || []);
    }
    if (typeof renderFavoritesModalContent === 'function') {
        renderFavoritesModalContent([]);
    }

    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('authToken');
        }
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem('authToken');
        }
    } catch (error) {
        console.error('Failed to clear auth token from storage:', error);
    }

    updateNavAuthUI();
    stopUnreadBadgePolling();
    if (typeof UI !== 'undefined' && UI.showSuccess) {
        UI.showSuccess('Logged out');
    }
}

/**
 * Switch bottom nav tab and corresponding page section.
 * Integrates with messages tab (message.js).
 */
function switchTab(tab) {
    // Update bottom nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    const navItems = document.querySelectorAll('.nav-item');
    const tabMap = { home: 0, search: 1, messages: 2, profile: 3 };
    if (navItems[tabMap[tab]]) {
        navItems[tabMap[tab]].classList.add('active');
    }

    // Update visible page
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    const pageMap = {
        home: 'homePage',
        search: 'searchPage',
        messages: 'messagesPage',
        profile: 'profilePage'
    };

    const targetPage = document.getElementById(pageMap[tab]);
    if (targetPage) {
        targetPage.classList.add('active');
    }

    // Tab-specific behavior
    if (tab === 'home') {
        loadListings();
    } else if (tab === 'search') {
        const searchInput = document.getElementById('searchPageInput');
        if (searchInput) {
            searchInput.value = '';
        }
        document.getElementById('searchResultsContainer').style.display = 'none';
        document.getElementById('popularSearchesSection').style.display = 'block';
        document.getElementById('searchHistorySection').style.display = 'block';
    } else if (tab === 'messages') {
        // Initialize messages view (thread list) from message.js
        if (typeof initMessagesPage === 'function') {
            initMessagesPage();
        }
    }
}

/**
 * Helper to switch to search tab and focus input.
 */
function switchToSearchPage() {
    switchTab('search');
    setTimeout(() => {
        const searchPageInput = document.getElementById('searchPageInput');
        if (searchPageInput) {
            searchPageInput.focus();
        }
    }, 100);
}

/**
 * Simple notifications placeholder.
 */
function showNotifications() {
    UI.showSuccess('No new notifications yet');
}

/**
 * Unread message badge logic (polls /api/messages/<user_id>/unread-count).
 */
let unreadBadgeInterval = null;

function stopUnreadBadgePolling() {
    if (unreadBadgeInterval) {
        clearInterval(unreadBadgeInterval);
        unreadBadgeInterval = null;
    }
}

async function refreshUnreadBadge() {
    const badge = document.getElementById('messageBadge');
    const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;

    if (!badge || !currentUser || !currentUser.id) {
        if (badge) {
            badge.style.display = 'none';
            badge.textContent = '0';
        }
        stopUnreadBadgePolling();
        return;
    }

    try {
        const data = await API.getUnreadCount(currentUser.id);
        const count = Number(data?.unread) || 0;
        if (count > 0) {
            badge.style.display = 'inline-block';
            badge.textContent = count > 99 ? '99+' : String(count);
        } else {
            badge.style.display = 'none';
            badge.textContent = '0';
        }
    } catch (error) {
        console.warn('Unread badge refresh failed:', error);
    }
}

function startUnreadBadgePolling() {
    stopUnreadBadgePolling();
    refreshUnreadBadge();
    unreadBadgeInterval = setInterval(refreshUnreadBadge, 20000);
}

/**
 * Shortcut to switch to messages tab.
 */
function showMessages() {
    switchTab('messages');
}

/**
 * Open a modal by ID.
 */
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

/**
 * Close a modal by ID.
 */
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

/**
 * Open the create-listing (publish) modal.
 */
function showPublishModal() {
    openModal('publishModal');
}

/**
 * Open "My Listings" modal and load user's listings.
 */
async function openMyListingsModal() {
    const modalId = 'myListingsModal';
    const container = document.getElementById('myListingsContainer');

    openModal(modalId);

    if (!container) {
        return;
    }

    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.id) {
        container.innerHTML = `
            <div class="profile-empty">
                <div class="empty-state-icon">🔐</div>
                Please log in to view your listings
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="profile-loading">Loading...</div>
    `;

    try {
        const listings = await loadMyListings('all');
        if (!listings || listings.length === 0) {
            container.innerHTML = `
                <div class="profile-empty">
                    <div class="empty-state-icon">📦</div>
                    <div>You have not posted any items yet</div>
                    <button class="submit-btn" onclick="closeModal('myListingsModal'); showPublishModal();">
                        Post now
                    </button>
                </div>
            `;
            return;
        }

        const cards = listings
            .map((listing, index) => {
                const listingIdSafe = String(listing.id).replace(/'/g, "\\'");
                return UI.renderProfileListingCard(listing, index, {
                    onClick: `closeModal('myListingsModal'); showListingDetail('${listingIdSafe}')`,
                    showStatus: true
                });
            })
            .join('');
        container.innerHTML = cards;
    } catch (error) {
        container.innerHTML = `
            <div class="profile-empty" style="color: #ef4444;">
                Failed to load your listings, please try again later
            </div>
        `;
    }
}

/**
 * Open "My Favorites" modal and load user's favorites.
 */
async function openFavoritesModal() {
    const modalId = 'myFavoritesModal';
    const container = document.getElementById('myFavoritesContainer');

    openModal(modalId);

    if (!container) {
        return;
    }

    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.id) {
        container.innerHTML = `
            <div class="profile-empty">
                <div class="empty-state-icon">🔐</div>
                Please log in to view your favorites
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="profile-loading">Loading...</div>
    `;

    try {
        const favorites = await loadUserFavorites();
        renderFavoritesModalContent(favorites);
    } catch (error) {
        container.innerHTML = `
            <div class="profile-empty" style="color: #ef4444;">
                Failed to load favorites, try again later
            </div>
        `;
    }
}

/**
 * Render content inside "My Favorites" modal.
 */
function renderFavoritesModalContent(favorites) {
    const container = document.getElementById('myFavoritesContainer');
    if (!container) return;

    const list = Array.isArray(favorites) ? favorites : (getState().userFavorites || []);

    if (!list || list.length === 0) {
        container.innerHTML = `
            <div class="profile-empty">
                <div class="empty-state-icon">❤️</div>
                <div>No favorited items yet</div>
                <button class="submit-btn" onclick="closeModal('myFavoritesModal'); switchTab('home');">
                    Browse items
                </button>
            </div>
        `;
        return;
    }

    const cards = list
        .map((listing, index) => {
            const listingIdSafe = String(listing.id).replace(/'/g, "\\'");
            return UI.renderProfileListingCard(listing, index, {
                onClick: `closeModal('myFavoritesModal'); showListingDetail('${listingIdSafe}')`,
                showFavoriteButton: true,
                favorited: true
            });
        })
        .join('');
    container.innerHTML = cards;
}

/**
 * Handle submit event for the "Publish listing" form.
 */
async function handlePublish(event) {
    event.preventDefault();

    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.id) {
        UI.showError('Please log in before posting items');
        return;
    }

    const formElement = document.getElementById('publishForm');
    const imagesInput = document.getElementById('publishImages');
    const formData = new FormData();

    formData.append('user_id', currentUser.id);
    formData.append('title', document.getElementById('publishTitle').value);
    const category = document.getElementById('publishCategory').value;
    formData.append('category', category);
    formData.append('price', document.getElementById('publishPrice').value);
    formData.append('description', document.getElementById('publishDescription').value);
    const meetupPoint = document.getElementById('publishMeetupPoint').value;
    formData.append('meetup_point', meetupPoint);
    const currentState = getState();
    const inferredCommunity = getCommunityIdFromMeetup(meetupPoint);
    const communityId =
        inferredCommunity ||
        (currentUser.community_id ? String(currentUser.community_id) : '') ||
        (currentState.currentCommunity ? String(currentState.currentCommunity) : '');
    formData.append('community_id', communityId);

    const courseCode = document.getElementById('publishCourseCode').value;
    if (courseCode && category === 'textbook') {
        formData.append('course_code', courseCode);
    }

    if (imagesInput && imagesInput.files) {
        Array.from(imagesInput.files).forEach(file => {
            formData.append('images', file);
        });
    }

    try {
        await API.createListing(formData);
        UI.showSuccess('Listing created!');
        closeModal('publishModal');
        if (formElement) {
            formElement.reset();
        }
        await loadListings();
        try {
            await loadMyListings();
        } catch (refreshError) {
            console.warn('Failed to refresh my listings after publish:', refreshError);
        }
    } catch (error) {
        console.error('Publish failed:', error);
        UI.showError('Publish failed, please try again later');
    }
}

/**
 * Show or hide course code field based on category selection.
 */
function handleCategoryChange() {
    const category = document.getElementById('publishCategory').value;
    const courseCodeGroup = document.getElementById('courseCodeGroup');
    if (courseCodeGroup) {
        courseCodeGroup.style.display = category === 'textbook' ? 'block' : 'none';
    }
}

/**
 * Mock communities for offline / error fallback.
 */
function getMockCommunities() {
    return [
        { id: 1, name: 'NYU Brooklyn Campus', type: 'university' },
        { id: 2, name: 'NYU Washington Square', type: 'university' }
    ];
}

function getCommunityIdFromMeetup(meetupPoint) {
    if (!meetupPoint) return '';
    const value = meetupPoint.toLowerCase();

    const tandonKeywords = [
        'dibner',
        'metrotech',
        'rogers hall',
        'lipton',
        'clark street',
        'tandon'
    ];
    const wsqKeywords = [
        'washington square',
        'bobst',
        'kimmel',
        'palladium',
        'third avenue north',
        'weinstein',
        'washington mews',
        'union square',
        'astor place'
    ];

    if (tandonKeywords.some(k => value.includes(k))) return '1';
    if (wsqKeywords.some(k => value.includes(k))) return '2';
    return '';
}

// Global DOMContentLoaded bootstrap
document.addEventListener('DOMContentLoaded', () => {
    if (typeof hydrateCurrentUserFromStorage === 'function') {
        hydrateCurrentUserFromStorage();
    }
    updateNavAuthUI();
    initApp();
    startUnreadBadgePolling();

    // Click outside modal to close
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('active');
            }
        });
    });
});
