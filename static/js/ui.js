/**
 * UI Utility Module
 * UI Utility Module - Renders UI components
 */

const UI = {
    // Gradient list
    gradients: [
        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
        'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
        'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'
    ],
    
    /**
     * Render community selector
     */
    renderCommunities(communities, activeId) {
        const select = document.getElementById('communitySelector');
        if (!select) return;

        if (!communities || communities.length === 0) {
            select.innerHTML = '<option value="" selected>No locations available</option>';
            select.disabled = true;
            return;
        }

        const options = communities.map(c => `
            <option value="${c.id}">${c.name}</option>
        `).join('');

        select.innerHTML = options;
        select.disabled = false;

        const targetValue = typeof activeId !== 'undefined' && activeId !== null
            ? String(activeId)
            : String(communities[0].id);

        select.value = targetValue;
    },
    
    /**
     * Render listings
     */
    renderListings(listings) {
        const container = document.getElementById('listingsContainer');
        if (!container) return;

        if (!listings || listings.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1/-1; text-align:center; padding:40px; color:#6b7280">
                    <div class="empty-state-icon">📦</div>
                    <div>No items available</div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = listings.map((listing, i) => this.renderListingCard(listing, i)).join('');
    },
    
    /**
     * Render single listing card
     */
    renderListingCard(listing, index) {
        const gradient = this.gradients[index % this.gradients.length];
        const listingId = String(listing.id);
        const listingIdLiteral = JSON.stringify(listingId);
        const listingIdSafe = listingId.replace(/'/g, "\\'");
        const favorited = typeof isListingFavorited === 'function' && isListingFavorited(listing.id);
        const favoriteIcon = favorited ? '❤️' : '🤍';
        const favoriteTitle = favorited ? 'Unfavorite' : 'Favorite';
        const hasImages = Array.isArray(listing.images) && listing.images.length > 0;
        const primaryImage = hasImages ? listing.images[0] : null;
        const safeTitle = (listing.title || '').replace(/"/g, '&quot;');
        const sellerNameRaw = (listing.user?.nickname || 'Seller').toString();
        const safeSellerName = sellerNameRaw
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        const meetupPoint = listing.meetup_point || 'Meetup TBD';
        const placeholder = `
            <div class="listing-placeholder" style="background: ${gradient};">
                ${(listing.title || '').substring(0, 20)}
            </div>
        `;
        const imageContent = primaryImage
            ? `<img src="${primaryImage}" alt="${safeTitle}" class="listing-photo" loading="lazy">`
            : placeholder;
        
        return `
            <div class="listing-card" onclick="showListingDetail('${listingIdSafe}')" data-listing-id="${listingId}" style="position: relative;">
                <button 
                    class="favorite-inline-btn" 
                    onclick="event.stopPropagation(); toggleFavorite('${listingIdSafe}');" 
                    title="${favoriteTitle}"
                    style="
                        position: absolute;
                        top: 10px;
                        right: 10px;
                        width: 36px;
                        height: 36px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: rgba(255, 255, 255, 0.95);
                        border: none;
                        border-radius: 50%;
                        font-size: 16px;
                        cursor: pointer;
                        box-shadow: 0 6px 16px rgba(0,0,0,0.12);
                    "
                >
                    ${favoriteIcon}
                </button>
                <div class="listing-image ${hasImages ? 'has-photo' : ''}">
                    ${imageContent}
                </div>
                <div class="listing-info">
                    <div class="listing-title">${listing.title}</div>
                    <div class="listing-price-row">
                        <div class="listing-price">$${listing.price}</div>
                    </div>
                    <div class="listing-meta">
                        <span class="seller-name">👤 ${safeSellerName}</span>
                        <span class="listing-location">📍 ${meetupPoint}</span>
                    </div>
                </div>
            </div>
        `;
    },
    
    /**
     * Render profile listing card
     */
    renderProfileListingCard(listing, index, options = {}) {
        const escape = (value) => (value ?? '').toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        const opts = options || {};
        const listingId = String(listing.id);
        const listingIdSafe = listingId.replace(/'/g, "\\'");
        const gradient = this.gradients[index % this.gradients.length];
        const plainTitle = (listing.title || '').toString();
        const hasImages = Array.isArray(listing.images) && listing.images.length > 0;
        const primaryImage = hasImages ? listing.images[0] : null;
        const safeTitle = escape(plainTitle || 'Untitled item');
        const categoryKey = (listing.category || 'other').toString().toLowerCase();
        const categoryMap = {
            textbook: { icon: '📚', label: 'Textbook' },
            furniture: { icon: '🪑', label: 'Furniture' },
            electronics: { icon: '💻', label: 'Electronics' },
            dorm_supplies: { icon: '🛏️', label: 'Dorm supplies' },
            rental: { icon: '🏢', label: 'Rental' },
            other: { icon: '🎯', label: 'Other' }
        };
        const categoryInfo = categoryMap[categoryKey] || categoryMap.other;

        const priceNumber = Number(listing.price);
        const priceDisplay = Number.isFinite(priceNumber)
            ? `$${priceNumber % 1 === 0 ? priceNumber.toFixed(0) : priceNumber.toFixed(2)}`
            : escape(listing.price || '—');

        const meetupPoint = escape(listing.meetup_point || 'Meetup TBD');
        const sellerName = escape(
            listing.nickname ||
            listing.seller_nickname ||
            listing.user?.nickname ||
            ''
        );

        const statusMap = {
            active: 'Active',
            sold: 'Sold',
            hidden: 'Hidden',
            flagged: 'Needs review'
        };
        const statusKey = (listing.status || '').toString().toLowerCase();
        const statusLabel = opts.showStatus && statusKey
            ? statusMap[statusKey] || escape(listing.status)
            : null;

        const description = escape(listing.description || '');

        const placeholderText = escape(plainTitle.substring(0, 12));
        const thumbnail = hasImages
            ? `<div class="profile-listing-thumb"><img src="${primaryImage}" alt="${safeTitle}"></div>`
            : `<div class="profile-listing-thumb placeholder" style="background:${gradient};">
                    ${placeholderText}
               </div>`;

        const onClick = opts.onClick ? `onclick="${opts.onClick}"` : `onclick="showListingDetail('${listingIdSafe}')"`;
        const favoriteBtn = opts.showFavoriteButton ? `
            <button class="profile-favorite-btn ${opts.favorited ? 'favorited' : ''}"
                    onclick="event.stopPropagation(); toggleFavorite('${listingIdSafe}');"
                    title="${opts.favorited ? 'Unfavorite' : 'Favorite'}">
                ${opts.favorited ? '❤️' : '🤍'}
            </button>
        ` : '';

        const sellerMarkup = sellerName ? `<span class="profile-listing-seller">👤 ${sellerName}</span>` : '';
        const descMarkup = description ? `<div class="profile-listing-desc">${description}</div>` : '';
        const statusMarkup = statusLabel ? `<span class="profile-listing-status status-${statusKey}">${statusLabel}</span>` : '';

        return `
            <div class="profile-listing-card" ${onClick}>
                ${favoriteBtn}
                ${thumbnail}
                <div class="profile-listing-body">
                    <div class="profile-listing-header">
                        <span class="profile-listing-title">${safeTitle}</span>
                        <div class="profile-price-status">
                            <span class="profile-listing-price">${priceDisplay}</span>
                            ${statusMarkup}
                        </div>
                    </div>
                    <div class="profile-listing-meta">
                        <span class="profile-listing-category">${categoryInfo.icon} ${categoryInfo.label}</span>
                        <span class="profile-listing-location">📍 ${meetupPoint}</span>
                        ${sellerMarkup}
                    </div>
                    ${descMarkup}
                </div>
            </div>
        `;
    },
    
    /**
     * Render listing detail
     */
    renderListingDetail(listing) {
        const listingId = String(listing.id);
        const listingIdSafe = listingId.replace(/'/g, "\\'");
        const listingIdAttr = listingIdSafe;
        const favorited = typeof isListingFavorited === 'function' && isListingFavorited(listing.id);
        const favoriteIcon = favorited ? '❤️' : '🤍';
        const favoriteTitle = favorited ? 'Unfavorite' : 'Favorite';
        const courseCode = listing.course_code ? `
            <div style="margin-bottom: 15px;">
                <strong>Course code：</strong> ${listing.course_code}
            </div>
        ` : '';
        const hasImages = Array.isArray(listing.images) && listing.images.length > 0;
        const primaryImage = hasImages ? listing.images[0] : null;
        const safeTitle = (listing.title || '').replace(/"/g, '&quot;');
        const sellerNameRaw = (listing.user?.nickname || 'Seller').toString();
        const safeSellerName = sellerNameRaw
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        const sellerAvatar = listing.user && listing.user.avatar ? listing.user.avatar : null;
        const sellerInitial = sellerNameRaw.trim().charAt(0).toUpperCase() || 'S';
        const sellerAvatarMarkup = sellerAvatar
            ? `<img src="${sellerAvatar}" alt="${safeSellerName}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:1px solid #e5e7eb;">`
            : `<div style="width:28px;height:28px;border-radius:50%;background:#e0e7ff;color:#4338ca;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;border:1px solid #c7d2fe;">${sellerInitial}</div>`;
        const meetupPoint = listing.meetup_point || 'Meetup TBD';
        const images = hasImages ? listing.images.filter(Boolean) : (primaryImage ? [primaryImage] : []);
        const carouselId = `detailCarousel-${listingIdSafe}`;
        const detailImage = images.length
            ? `
                <div class="detail-carousel" id="${carouselId}">
                    ${images.map((img, idx) => `
                        <div class="detail-slide" data-carousel-item style="display:${idx === 0 ? 'flex' : 'none'};">
                            <img src="${img}" alt="${safeTitle}" class="listing-photo">
                        </div>
                    `).join('')}
                    ${images.length > 1 ? `
                        <button class="carousel-btn prev" onclick="carouselPrev('${carouselId}')">‹</button>
                        <button class="carousel-btn next" onclick="carouselNext('${carouselId}')">›</button>
                        <div class="carousel-dots">
                            ${images.map((_, idx) => `<span class="dot" data-dot-index="${idx}" onclick="carouselGo('${carouselId}', ${idx})"></span>`).join('')}
                        </div>
                    ` : ''}
                </div>
              `
            : `<div class="listing-placeholder" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                    ${listing.title}
               </div>`;
        
        return `
            <div style="margin-bottom: 15px; position: relative;">
                <div class="listing-image ${hasImages ? 'has-photo' : ''} detail-portrait">
                    ${detailImage}
                </div>
                <button 
                    id="favoriteToggleBtn"
                    class="favorite-detail-btn ${favorited ? 'favorited' : ''}"
                    onclick="toggleFavorite('${listingIdSafe}')"
                    title="${favoriteTitle}"
                    style="
                        position: absolute;
                        top: 12px;
                        right: 12px;
                        width: 48px;
                        height: 48px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: rgba(255,255,255,0.96);
                        border: none;
                        border-radius: 50%;
                        font-size: 20px;
                        cursor: pointer;
                        box-shadow: 0 8px 20px rgba(0,0,0,0.15);
                        transition: transform 0.15s ease;
                    "
                >
                    ${favoriteIcon}
                </button>
            </div>
            <h3 style="font-size: 18px; margin-bottom: 10px;">${listing.title}</h3>
            <div class="listing-price" style="margin-bottom: 15px;">$${listing.price}</div>
            <div style="margin-bottom: 15px;">
                <strong>Item description:</strong>
                <p style="color: #6b7280; margin-top: 5px;">
                    ${listing.description || 'Used for one semester, no scratches or notes.'}
                </p>
            </div>
            ${courseCode}
            <div style="margin-bottom: 15px;">
                <strong>Recommended meetup point:</strong> 📍 ${meetupPoint}
            </div>
            <div style="margin-bottom: 20px;">
                <strong>Seller:</strong> 
                <span class="seller-name detail">${safeSellerName}</span>
            </div>
            <button class="submit-btn" data-action="contact-seller" data-listing-id="${listingIdAttr}">
                💬 Contact seller
            </button>
        `;
    },
    
    /**
     * Render search results
     */
    renderSearchResults(results, query) {
        if (!results || results.length === 0) {
            return `
                <div class="empty-placeholder">
                    <div class="empty-state-icon">🔍</div>
                    <div style="font-size: 16px; margin-bottom: 8px;">No results for“${query}”related results</div>
                    <div style="font-size: 14px;">Try adjusting the keyword or check trending signals</div>
                </div>
            `;
        }
        
        const items = results.map((listing, i) => {
            const listingIdSafe = String(listing.id).replace(/'/g, "\\'");
            const gradient = this.gradients[i % this.gradients.length];
            const hasImages = Array.isArray(listing.images) && listing.images.length > 0;
            const primaryImage = hasImages ? listing.images[0] : null;
            const safeTitle = (listing.title || '').replace(/"/g, '&quot;');
            const sellerNameRaw = (listing.user?.nickname || 'Seller').toString();
            const safeSellerName = sellerNameRaw
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
            const thumbnail = hasImages
                ? `<img src="${primaryImage}" alt="${safeTitle}" class="search-result-thumb">`
                : `<div class="search-result-thumb placeholder" style="background:${gradient};">
                        ${(listing.title || '').substring(0, 15)}
                   </div>`;
            const meetupPoint = listing.meetup_point || 'Meetup TBD';
            
            return `
                <div class="search-result-item" onclick="showListingDetailFromSearch('${listingIdSafe}')">
                    ${thumbnail}
                    <div class="search-result-body">
                        <div class="search-result-title">${listing.title}</div>
                        <div class="search-result-price">$${listing.price}</div>
                        <div class="search-result-meta">
                            <span class="search-result-meta-item">👤 ${safeSellerName}</span>
                            <span class="search-result-meta-item">📍 ${meetupPoint}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        return `<div class="search-results-list">${items}</div>`;
    },
    
    /**
     * Render trending tags
     */
    renderPopularTags(tags) {
        return tags.map(tag => 
            `<div class="search-tag" onclick="searchByTag('${tag}')">${tag}</div>`
        ).join('');
    },
    
    /**
     * Render search history
     */
    renderSearchHistory(history) {
        if (!history || history.length === 0) {
            return '<div style="color: #6b7280; font-size: 14px;">No search history</div>';
        }
        
        return history.map(term => {
            const safeAttr = term.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            const safeLabel = term
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
            return `
                <div class="search-tag" onclick="searchByTag('${safeAttr}')">
                    <span>${safeLabel}</span>
                    <span onclick="event.stopPropagation(); removeFromHistory('${safeAttr}')" 
                          style="margin-left: 6px; cursor: pointer; opacity: 0.6;">×</span>
                </div>
            `;
        }).join('');
    },
    
    /**
     * Show loading status
     */
    showLoading(containerId, message = 'Loading...') {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="loading">${message}</div>
            `;
        }
    },
    
    /**
     * Show empty status
     */
    showEmpty(containerId, icon = '📦', message = 'No data') {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">${icon}</div>
                    <div>${message}</div>
                </div>
            `;
        }
    },
    
    /**
     * Show error message
     */
    showError(message) {
        renderToast(message, 'error');
    },
    
    /**
     * 
     */
    showSuccess(message) {
        renderToast(message, 'success');
    }
};

/**
 * Lightweight toast notifications (top-right)
 */
function renderToast(message, type = 'info') {
    if (typeof document === 'undefined') return;

    let container = document.getElementById('globalToastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'globalToastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-bubble ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    // trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 250);
    }, 2800);
}

// 
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UI;
}
