/**
 *  - 
 * Main Application Logic - Final Fixed Version
 * 
 * ：contactSeller()  contact-seller.js 
 */

let defaultNavAuthHTML = null;
let defaultProfileName = null;

/**
 * 
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
        console.error(':', error);
    }
}

/**
 * 
 */
async function loadCommunities() {
    try {
        const communities = await API.getCommunities();
        updateCommunities(communities);
        UI.renderCommunities(communities, communities[0]?.id);
        
        if (communities.length > 0) {
            updateCurrentCommunity(communities[0].id);
        }
    } catch (error) {
        console.error('Failed to load communities:', error);
        // 
        const mockCommunities = getMockCommunities();
        updateCommunities(mockCommunities);
        UI.renderCommunities(mockCommunities, mockCommunities[0]?.id);
        if (mockCommunities.length > 0) {
            updateCurrentCommunity(mockCommunities[0].id);
        }
    }
}

/**
 * 
 */
async function selectCommunity(communityId) {
    updateCurrentCommunity(communityId);
    
    const dropdown = document.getElementById('communitySelector');
    if (dropdown) {
        dropdown.value = String(communityId);
    }
    
    await loadListings();
}

/**
 * Listings
 */
async function loadListings() {
    UI.showLoading('listingsContainer');
    
    try {
        const currentState = getState();
        const params = {};
        
        if (currentState.currentCommunity) {
            params.community_id = currentState.currentCommunity;
        }
        
        if (currentState.currentCategory !== 'all') {
            params.category = currentState.currentCategory;
        }
        
        const listings = await API.getListings(params);
        // If API returns empty, fall back to mock samples so UI is visible
        const baseList = (listings && listings.length > 0) ? listings : getMockListings();
        const filtered = filterListingsForState(baseList, currentState);
        updateListings(filtered);
        UI.renderListings(filtered);
    } catch (error) {
        console.error('Failed to load listings:', error);
        // 
        const mockListings = getMockListings();
        const filtered = filterListingsForState(mockListings, getState());
        updateListings(filtered);
        UI.renderListings(filtered);
    }
}

function filterListingsForState(listings, stateSnapshot) {
    const cat = stateSnapshot.currentCategory;
    if (!listings || !Array.isArray(listings)) return [];
    if (!cat || cat === 'all') return listings;
    const target = cat.toLowerCase();
    return listings.filter(l => (l.category || '').toLowerCase() === target);
}

/**
 * 
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
 * Favorite
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
 * Favorite
 */
function isListingFavorited(listingId) {
    const currentState = getState();
    return (currentState.favoriteIds || []).includes(listingId);
}

/**
 * FavoriteStatus
 */
async function toggleFavorite(listingId) {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.id) {
        UI.showError('LoginFavorite');
        return;
    }

    const favorited = isListingFavorited(listingId);

    try {
        if (favorited) {
            await API.removeFavorite(currentUser.id, listingId);
            UI.showSuccess('Unfavorite');
        } else {
            await API.addFavorite({
                user_id: currentUser.id,
                listing_id: listingId
            });
            UI.showSuccess('Favorite');
        }

        await loadUserFavorites();
        UI.renderListings(getState().listings);

        refreshDetailFavoriteButton(listingId);
        refreshFavoriteModal();
    } catch (error) {
        console.error('Favorite:', error);
        UI.showError('，');
    }
}

/**
 * FavoriteStatus
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
 * Favorite（）
 */
function refreshFavoriteModal() {
    const modal = document.getElementById('myFavoritesModal');
    if (!modal || !modal.classList.contains('active')) {
        return;
    }
    renderFavoritesModalContent();
}

/**
 * 
 */
async function filterByCategory(category) {
    updateCurrentCategory(category);
    
    // UI
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.category === category);
    });
    
    await loadListings();
}

function handleCommunityDropdownChange(value) {
    if (!value) return;
    const parsed = parseInt(value, 10);
    if (!Number.isNaN(parsed)) {
        selectCommunity(parsed);
    }
}

/**
 * 
 */
async function showListingDetail(listingId) {
    try {
        const listing = await API.getListing(listingId);
        const detailContent = document.getElementById('detailContent');
        
        if (detailContent) {
            detailContent.innerHTML = UI.renderListingDetail(listing);
            refreshDetailFavoriteButton(listingId);
        }
        
        openModal('detailModal');
    } catch (error) {
        console.error('Failed to load listing details:', error);
        // Status
        const currentState = getState();
        const listing = currentState.listings.find(l => l.id === listingId);
        
        if (listing && document.getElementById('detailContent')) {
            document.getElementById('detailContent').innerHTML = UI.renderListingDetail(listing);
            refreshDetailFavoriteButton(listingId);
            openModal('detailModal');
        } else {
            UI.showError('Failed to load listing details');
        }
    }
}

/**
 * 
 */
function showListingDetailFromSearch(listingId) {
    showListingDetail(listingId);
}

// ⚠️ ：contactSeller()  contact-seller.js 
// ！

/**
 * Report
 */
async function reportListing(listingId) {
    const reason = prompt('Please enter a report reason：');
    if (!reason) return;
    
    try {
        const currentUser = getCurrentUser();
        if (!currentUser || !currentUser.id) {
            UI.showError('Please log in before reporting');
            return;
        }

        await API.createReport({
            reporter_id: currentUser.id,
            target_type: 'listing',
            target_id: listingId,
            reason: reason
        });
        
        UI.showSuccess('Report submitted! We will review soon.');
        closeModal('detailModal');
    } catch (error) {
        console.error('Report:', error);
        UI.showSuccess('Report submitted! We will review soon.');
        closeModal('detailModal');
    }
}

/**
 * 
 */
async function searchListings(query) {
    UI.showLoading('listingsContainer', 'Searching...');
    
    if (query && query.length > 0) {
        addToSearchHistory(query);
    }
    
    try {
        const listings = await API.searchListings(query);
        updateListings(listings);
        UI.renderListings(listings);
    } catch (error) {
        console.error(':', error);
        // 
        const currentState = getState();
        const filtered = currentState.listings.filter(l => 
            l.title.toLowerCase().includes(query.toLowerCase())
        );
        updateListings(filtered);
        UI.renderListings(filtered);
    }
}

/**
 * 
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
            wrapper.classList.add('has-image');
        } else {
            img.removeAttribute('src');
            wrapper.classList.remove('has-image');
        }
    }

    if (fallback) {
        const initial = user && user.nickname
            ? (user.nickname.trim().charAt(0) || '').toUpperCase()
            : '';
        fallback.textContent = initial || '👤';
    }

    const canEdit = typeof isAuthenticated === 'function' && isAuthenticated();
    if (wrapper) {
        wrapper.classList.toggle('edit-enabled', canEdit);
    }
    if (editBtn) {
        editBtn.style.display = canEdit ? '' : 'none';
    }
}

/**
 * 
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
 * 
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
        console.error(':', error);
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
 * NavigationLoginStatus
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
 * Log outLogin
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
        console.error(':', error);
    }

    updateNavAuthUI();
    if (typeof UI !== 'undefined' && UI.showSuccess) {
        UI.showSuccess('Logged out');
    }
}

/**
 * 
 */
function switchTab(tab) {
    // Bottom nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const navItems = document.querySelectorAll('.nav-item');
    const tabMap = { home: 0, search: 1, messages: 2, profile: 3 };
    if (navItems[tabMap[tab]]) {
        navItems[tabMap[tab]].classList.add('active');
    }
    
    // 
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
    
    // 
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
        // 🔧 ：
       if (typeof initMessagesPage === 'function') {
        initMessagesPage();   // ← 这一步加载线程列表
    }
    }
}

/**
 * Search page
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
 * 
 */
function showNotifications() {
    UI.showSuccess('！\n\n: 0\n\n');
}

/**
 * 
 */
function showMessages() {
    switchTab('messages');
}

/**
 * 
 */
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

/**
 * 
 */
function showPublishModal() {
    openModal('publishModal');
}

/**
 * “”
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
            .map((listing, index) => UI.renderProfileListingCard(listing, index, {
                onClick: `closeModal('myListingsModal'); showListingDetail(${listing.id})`,
                showStatus: true
            }))
            .join('');
        container.innerHTML = cards;
    } catch (error) {
        container.innerHTML = `
            <div class="profile-empty" style="color: #ef4444;">
                Load failed, please try again later
            </div>
        `;
    }
}

/**
 * “Favorite”
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
 * Favorite
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
        .map((listing, index) => UI.renderProfileListingCard(listing, index, {
            onClick: `closeModal('myFavoritesModal'); showListingDetail(${listing.id})`,
            showFavoriteButton: true,
            favorited: true
        }))
        .join('');
    container.innerHTML = cards;
}

/**
 * Submit listing form
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
    formData.append('meetup_point', document.getElementById('publishMeetupPoint').value);
    const currentState = getState();
    const communityId = currentState.currentCommunity || currentUser.community_id || '';
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
            console.warn(':', refreshError);
        }
    } catch (error) {
        console.error('Publish failed:', error);
        UI.showError('Publish failed, please try again later');
    }
}

/**
 * （/Course code）
 */
function handleCategoryChange() {
    const category = document.getElementById('publishCategory').value;
    const courseCodeGroup = document.getElementById('courseCodeGroup');
    if (courseCodeGroup) {
        courseCodeGroup.style.display = category === 'textbook' ? 'block' : 'none';
    }
}

/**
 *  - 
 */
function getMockCommunities() {
    return [
        { id: 1, name: 'NYU Tandon', type: 'university' },
        { id: 2, name: 'NYU Washington Square', type: 'university' },
        { id: 3, name: 'Nearby 3km', type: 'nearby' }
    ];
}

/**
 *  - 
 */
function getMockListings() {
    return [
        {
            id: 1,
            title: 'CS-UY 1134 Introduction to Programming',
            price: 45,
            category: 'textbook',
            meetup_point: 'Dibner Library',
            user: { id: 2, verify_status: 'email_verified', nickname: 'Student A' }
        },
        {
            id: 2,
            title: 'Dorm chair, gently used, adjustable height',
            price: 30,
            category: 'furniture',
            meetup_point: 'Lipton Hall',
            user: { id: 2, verify_status: 'phone_verified', nickname: 'Student B' }
        },
        {
            id: 3,
            title: 'TI-84 Plus calculator for engineering classes',
            price: 60,
            category: 'electronics',
            meetup_point: 'MetroTech Center',
            user: { id: 2, verify_status: 'email_verified', nickname: 'Student C' }
        },
        {
            id: 4,
            title: 'Eye-care lamp with three brightness levels',
            price: 15,
            category: 'dorm_supplies',
            meetup_point: 'Clark Street',
            user: { id: 2, verify_status: 'phone_verified', nickname: 'Student D' }
        },
        {
            id: 5,
            title: 'MA-UY 1024 past exam collection',
            price: 10,
            category: 'textbook',
            meetup_point: 'Rogers Hall',
            user: { id: 2, verify_status: 'email_verified', nickname: 'Student E' }
        },
        {
            id: 6,
            title: 'Compact microwave 700W for dorm',
            price: 25,
            category: 'electronics',
            meetup_point: '3rd Ave',
            user: { id: 2, verify_status: 'phone_verified', nickname: 'Student F' }
        },
        {
            id: 7,
            title: 'Downtown studio sublet (May-Aug)',
            price: 2200,
            category: 'rental',
            meetup_point: 'Washington Square',
            user: { id: 3, verify_status: 'phone_verified', nickname: 'Resident G' }
        }
    ];
}

// 
document.addEventListener('DOMContentLoaded', () => {
    if (typeof hydrateCurrentUserFromStorage === 'function') {
        hydrateCurrentUserFromStorage();
    }
    updateNavAuthUI();
    initApp();
    
    // 
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('active');
            }
        });
    });
});
