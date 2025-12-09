/**
 * Contact seller feature - patched
 * Contact Seller Module - Fixed Version
 * 
 * Handles the flow from clicking contact seller to sending message
 */

// ===== State management =====
let dialogThreadId = null;
let dialogThread = null; // { threadId, listing, buyerId, sellerId, buyerNickname, sellerNickname }
let messageRefreshInterval = null;

/**
 * Contact seller - Main entry
 */
async function contactSeller(listingId) {
    try {
        console.log('Contact seller...', { listingId });
        
        const listing = await getListing(listingId);
        const currentUser = getCurrentUser();
        
        if (!currentUser || !currentUser.id) {
            showError('Please log in before contacting the seller');
            return;
        }
        
        if (!listing) {
            showError('Listing not found');
            return;
        }
        
        if (!listing.user || !listing.user.id) {
            showError('Unable to get seller info');
            return;
        }
        
        if (listing.user.id === currentUser.id) {
            showError('Cannot contact yourself');
            return;
        }
        
        const existingThreadId = await findExistingThreadId(currentUser.id, listing.user.id, listingId);
        let threadId = existingThreadId;

        if (!threadId) {
            console.log('No existing thread. Creating...', {
                buyer_id: currentUser.id,
                seller_id: listing.user.id,
                listing_id: listingId
            });
            const threadResponse = await createThread(
                currentUser.id,
                listing.user.id,
                listingId,
                currentUser.nickname || currentUser.name || `User ${currentUser.id}`,
                listing.user.nickname || listing.user.name || `User ${listing.user.id}`
            );
            threadId = threadResponse.id || threadResponse;
        }
        
        console.log('Using thread ID:', threadId);
        
        await openMessageDialog(threadId, listing, listing.user);
        
        console.log('Contact seller succeeded');
        
    } catch (error) {
        console.error('Contact seller failed:', error);
        showError('Contact seller failed: ' + error.message);
    }
}

/**
 * Try to find an existing thread between buyer/seller for the listing
 */
async function findExistingThreadId(buyerId, sellerId, listingId) {
    try {
        const resp = await fetch(`/api/threads/${buyerId}`);
        if (!resp.ok) return null;
        const threads = await resp.json();
        const match = (threads || []).find(t => {
            const sameListing = String(t.listing_id) === String(listingId);
            const samePair =
                (String(t.buyer_id) === String(buyerId) && String(t.seller_id) === String(sellerId)) ||
                (String(t.buyer_id) === String(sellerId) && String(t.seller_id) === String(buyerId));
            return sameListing && samePair;
        });
        return match ? match.id || match.thread_id : null;
    } catch (err) {
        console.warn('Failed to check existing thread', err);
        return null;
    }
}

/**
 * Create thread
 */
async function createThread(buyerId, sellerId, listingId) {
    try {
        const response = await fetch('/api/threads', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                buyer_id: buyerId,
                seller_id: sellerId,
                listing_id: listingId
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create thread');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Failed to create thread:', error);
        throw new Error('Unable to create thread: ' + error.message);
    }
}

// ===== Message dialog management =====

async function openMessageDialog(threadId, listing, seller) {
    try {
        const currentUser = getCurrentUser();
        dialogThreadId = threadId;
        dialogThread = {
            threadId,
            listing: listing || null,
            buyerId: currentUser?.id || null,
            sellerId: seller?.id || null,
            buyerNickname: currentUser?.nickname || null,
            sellerNickname: seller?.nickname || null
        };
        
        if ((!listing || !listing.meetup_point || !listing.category) && listing?.id) {
            try {
                const freshListing = await getListing(listing.id);
                if (freshListing) {
                    dialogThread.listing = freshListing;
                    listing = freshListing;
                }
            } catch (fetchError) {
                console.warn('Failed to complete listing info:', fetchError);
            }
        }
        
        const dialogTitle = document.getElementById('messageDialogTitle');
        if (dialogTitle) {
            const sellerName = getChatPartnerNickname();
            dialogTitle.textContent = sellerName ? `Chat with ${sellerName}` : 'Chat';
        }
        
        renderProductInfo(dialogThread.listing || listing);
        
        await loadDialogMessages(threadId);
        
        openModal('messageDialog');
        
        setTimeout(() => {
            const input = document.getElementById('messageInput');
            if (input) input.focus();
        }, 100);
        
    } catch (error) {
        console.error('Failed to open dialog:', error);
        showError('Failed to open dialog: ' + error.message);
    }
}

function renderProductInfo(listing) {
    const productInfo = document.getElementById('messageProductInfo');
    if (!productInfo) return;
    if (!listing) {
        productInfo.innerHTML = '';
        return;
    }
    const images = Array.isArray(listing.images) ? listing.images.filter(Boolean) : [];
    const primaryImage = images.length > 0 ? images[0] : null;
    const placeholderColor = getColorByCategory(listing.category);
    const thumb = primaryImage
        ? `<img src="${primaryImage}" alt="${listing.title || 'Listing'}" style="width:64px;height:64px;border-radius:16px;object-fit:cover;box-shadow:0 4px 12px rgba(0,0,0,0.08);">`
        : `<div class="message-product-thumb" style="background:${placeholderColor};">
                ${(listing.title || '').substring(0, 10)}
           </div>`;

    productInfo.innerHTML = `
        <div class="message-product-card">
            ${thumb}
            <div class="message-product-body">
                <div class="message-product-title">${listing.title}</div>
                <div class="message-product-price">$${listing.price}</div>
                <div class="message-product-meta">📍 ${listing.meetup_point || 'Meetup location not set'}</div>
            </div>
        </div>
    `;
}

function getColorByCategory(category) {
    const colors = {
        textbook: '#667eea',
        furniture: '#ec4899',
        electronics: '#3b82f6',
        dorm_supplies: '#8b5cf6',
        rental: '#22d3ee',
        other: '#6b7280'
    };
    return colors[category] || '#9ca3af';
}

function closeMessageDialog() {
    dialogThreadId = null;
    dialogThread = null;
    if (messageRefreshInterval) {
        clearInterval(messageRefreshInterval);
        messageRefreshInterval = null;
    }
    closeModal('messageDialog');
}

// ===== Message loading and display =====

async function loadDialogMessages(threadId) {
    try {
        const messagesContainer = document.getElementById('messagesContainer');
        if (!messagesContainer) {
            console.error('Message container missing');
            return;
        }
        
        messagesContainer.innerHTML =
            '<div class="loading" style="text-align: center; color: #9ca3af; padding: 20px;">Loading messages...</div>';
        
        const currentUser = getCurrentUser();
        const userId = currentUser && currentUser.id ? currentUser.id : null;
        const url = userId
            ? `/api/threads/${threadId}/messages?user_id=${encodeURIComponent(userId)}`
            : `/api/threads/${threadId}/messages`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('Failed to load messages');
        }
        
        const messages = await response.json();
        console.log('Messages:', messages);
        
        if (!messages || messages.length === 0) {
            messagesContainer.innerHTML =
                '<div style="text-align: center; color: #6b7280; padding: 20px;">Start a new conversation</div>';
        } else {
            messagesContainer.innerHTML = messages.map(msg => renderMessage(msg)).join('');
            
            setTimeout(() => {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }, 100);
        }

        // After marking as read, refresh unread badge
        if (typeof refreshUnreadBadge === 'function') {
            refreshUnreadBadge();
        }
    } catch (error) {
        console.error('Failed to load messages:', error);
        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
            messagesContainer.innerHTML =
                '<div style="text-align: center; color: #ef4444; padding: 20px;">Failed to load messages</div>';
        }
    }
}

function renderMessage(message) {
    const currentUser = getCurrentUser();
    const currentUserId = currentUser && currentUser.id ? currentUser.id : null;
    const isOwn = currentUserId ? message.sender_id === currentUserId : false;
    
    return `
        <div style="display: flex; margin-bottom: 12px; justify-content: ${isOwn ? 'flex-end' : 'flex-start'};">
            <div style="max-width: 70%; background: ${isOwn ? '#5b21b6' : '#f3f4f6'}; 
                        color: ${isOwn ? 'white' : '#111827'}; padding: 10px 14px; 
                        border-radius: 12px; word-break: break-word; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                <div style="font-size: 14px; line-height: 1.5;">
                    ${escapeHtml(message.content)}
                </div>
                <div style="font-size: 11px; margin-top: 5px; opacity: 0.7;">
                    ${formatTime(message.created_at)}
                </div>
            </div>
        </div>
    `;
}

// ===== Send message =====

async function sendDialogMessage() {
    try {
        const input = document.getElementById('messageInput');
        const content = input.value.trim();
        
        if (!content) {
            showError('Please enter message content');
            return;
        }
        
        if (content.length > 1000) {
            showError('Message too long (max 1000 chars)');
            return;
        }
        
        if (!dialogThreadId) {
            showError('No thread ID');
            return;
        }
        
        const currentUser = getCurrentUser();
        if (!currentUser || !currentUser.id) {
            showError('Please log in before sending messages');
            return;
        }

        const receiverId = getChatPartnerId();
        
        if (!receiverId) {
            showError('Cannot determine recipient, please refresh and try again');
            return;
        }
        
        const sendBtn = document.getElementById('messageSendBtn');
        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.textContent = 'Sending...';
        }
        
        console.log('Sending message...', {
            thread_id: dialogThreadId,
            sender_id: currentUser.id,
            to_user_id: receiverId,
            content: content
        });
        
        const response = await fetch('/api/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                thread_id: dialogThreadId,
                sender_id: currentUser.id,
                content: content
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Send failed');
        }
        
        await response.json();
        
        input.value = '';
        
        await loadDialogMessages(dialogThreadId);
        
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send';
        }
        
    } catch (error) {
        console.error('Failed to send message:', error);
        showError('Failed to send message: ' + error.message);
        
        const sendBtn = document.getElementById('messageSendBtn');
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send';
        }
    }
}

function getChatPartnerId() {
    if (!dialogThread) return null;
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.id) return null;
    
    if (currentUser.id === dialogThread.buyerId) {
        return dialogThread.sellerId;
    }
    if (currentUser.id === dialogThread.sellerId) {
        return dialogThread.buyerId;
    }
    return null;
}

function getChatPartnerNickname() {
    if (!dialogThread) return null;
    if (dialogThread.sellerNickname) return dialogThread.sellerNickname;
    if (dialogThread.listing && dialogThread.listing.user && dialogThread.listing.user.nickname) {
        return dialogThread.listing.user.nickname;
    }
    return 'Seller';
}

// ===== Message list page (optional) =====

async function loadMessagesPage() {
    try {
        const currentUser = getCurrentUser();
        const threadList = document.getElementById('threadList');
        
        if (!threadList) {
            console.error('Thread container missing');
            return;
        }
        
        if (!currentUser || !currentUser.id) {
            threadList.innerHTML =
                '<div style="text-align: center; color: #6b7280; padding: 40px;">Please log in to view messages</div>';
            return;
        }
        
        threadList.innerHTML =
            '<div style="text-align: center; color: #9ca3af; padding: 40px;">Loading...</div>';
        
        const response = await fetch(`/api/threads/${currentUser.id}`);
        
        if (!response.ok) {
            throw new Error('Load failed');
        }
        
        const threads = await response.json();
        console.log('Threads:', threads);
        
        if (!threads || threads.length === 0) {
            threadList.innerHTML =
                '<div style="text-align: center; color: #6b7280; padding: 40px;">💬<br>No messages</div>';
            return;
        }
        
        const enrichedThreads = await Promise.all(
            threads.map(async (thread) => {
                let listing = null;
                try {
                    listing = await getListing(thread.listing_id);
                } catch (_err) {
                    listing = null;
                }
                return { ...thread, listing };
            })
        );

        threadList.innerHTML = enrichedThreads.map(thread => renderThreadItem(thread)).join('');
        
    } catch (error) {
        console.error('Load messages:', error);
        const threadList = document.getElementById('threadList');
        if (threadList) {
            threadList.innerHTML =
                '<div style="text-align: center; color: #ef4444; padding: 40px;">Load messages failed</div>';
        }
    }
}

function renderThreadItem(thread) {
    const currentUser = getCurrentUser();
    const isBuyer = currentUser && currentUser.id === thread.buyer_id;
    const otherNickname = isBuyer
        ? (thread.seller_nickname || 'Seller')
        : (thread.buyer_nickname || '');
    const listing = thread.listing || {};
    const time = formatTime(thread.created_at);
    
    return `
        <div class="thread-item" onclick="openThreadFromList(${thread.id})">
            <div class="thread-header">
                <div class="thread-title">${otherNickname}</div>
                <div class="thread-time">${time}</div>
            </div>
            <div class="thread-preview">${listing.title || 'Listing'}</div>
            <div class="thread-price">${listing.price ? `$${listing.price}` : ''}</div>
        </div>
    `;
}

async function openThreadFromList(threadId) {
    try {
        const currentUser = getCurrentUser();
        if (!currentUser || !currentUser.id) {
            showError('Please log in');
            return;
        }
        
        dialogThreadId = threadId;
        
        const allThreadsResp = await fetch(`/api/threads/${currentUser.id}`);
        if (!allThreadsResp.ok) {
            throw new Error('Failed to fetch threads');
        }
        const threads = await allThreadsResp.json();
        const thread = threads.find(t => String(t.id) === String(threadId));
        if (!thread) {
            throw new Error('Thread not found');
        }
        
        let listingData = null;
        try {
            listingData = await getListing(thread.listing_id);
        } catch (_err) {
            listingData = null;
        }
        
        dialogThread = {
            threadId,
            listing: listingData || {
                id: thread.listing_id,
                title: listingData?.title || 'Listing',
                price: listingData?.price || '',
                meetup_point: listingData?.meetup_point || 'Meetup location not set',
                category: listingData?.category || 'other'
            },
            buyerId: thread.buyer_id,
            sellerId: thread.seller_id,
            buyerNickname: thread.buyer_nickname,
            sellerNickname: thread.seller_nickname
        };
        
        const dialogTitle = document.getElementById('messageDialogTitle');
        if (dialogTitle) {
            const sellerName = thread.seller_nickname || 'Seller';
            dialogTitle.textContent = `Chat with ${sellerName}`;
        }
        
        const productInfo = document.getElementById('messageProductInfo');
        if (productInfo) {
            const listing = dialogThread.listing || {};
            productInfo.innerHTML = `
                <div class="message-product-card">
                    <div class="message-product-thumb">
                        ${(listing.title || '').substring(0, 10)}
                    </div>
                    <div class="message-product-body">
                        <div class="message-product-title">${listing.title || 'Listing'}</div>
                        <div class="message-product-price">${listing.price ? `$${listing.price}` : ''}</div>
                        <div class="message-product-meta">📍 ${listing.meetup_point || 'Meetup location not set'}</div>
                    </div>
                </div>
            `;
        }

        await loadDialogMessages(threadId);
        
        openModal('messageDialog');
        
    } catch (error) {
        console.error('Failed to open thread:', error);
        showError('Failed to open thread');
    }
}

// ===== Helpers =====

async function getListing(listingId) {
    try {
        const currentState = getState();
        let listing = currentState.listings.find(l => l.id === listingId);
        
        if (!listing) {
            const response = await fetch(`/api/listings/${listingId}`);
            if (!response.ok) {
                throw new Error('Failed to get listing');
            }
            listing = await response.json();
        }
        
        return listing;
    } catch (error) {
        console.error('Failed to get listing info:', error);
        return null;
    }
}

function formatTime(dateString) {
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) {
            return 'Just now';
        }
        if (diff < 3600000) {
            return Math.floor(diff / 60000) + ' minutes ago';
        }
        if (diff < 86400000) {
            return Math.floor(diff / 3600000) + ' hours ago';
        }
        
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${date.getMonth() + 1}/${date.getDate()} ${hours}:${minutes}`;
    } catch (e) {
        console.error('Time formatting failed:', e);
        return dateString;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showError(message) {
    if (typeof UI !== 'undefined' && UI.showError) {
        UI.showError(message);
    }
}

function initContactSeller() {
    console.log('✓ Contact seller initialized');
    
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendDialogMessage();
            }
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initContactSeller);
} else {
    initContactSeller();
}

if (typeof window !== 'undefined') {
    window.contactSeller = contactSeller;
    window.closeMessageDialog = closeMessageDialog;
}
