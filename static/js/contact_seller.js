/**
 * Contact seller feature - patched
 * Contact Seller Module - Fixed Version
 * 
 * Handles the flow from clicking contact seller to sending message
 */

// ===== State management =====
let currentThreadId = null;
let currentThread = null; // { threadId, listing, buyerId, sellerId, buyerNickname, sellerNickname }
let messageRefreshInterval = null;

/**
 * Contact seller - Main entry
 * Triggered when user clicks the contact seller button
 */
async function contactSeller(listingId) {
    try {
        console.log('Contact seller...', { listingId });
        
        // 1. Fetch listing info and current user
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
        
        // 2. Prevent contacting yourself
        if (listing.user.id === currentUser.id) {
            showError('Cannot contact yourself');
            return;
        }
        
        // 3. Create or get thread
        console.log('Creating thread...', {
            buyer_id: currentUser.id,
            seller_id: listing.user.id,
            listing_id: listingId
        });
        
        const threadResponse = await createThread(
            currentUser.id,
            listing.user.id,
            listingId
        );
        
        const threadId = threadResponse.id || threadResponse;
        console.log('Thread created, ID:', threadId);
        
        // 4. Open message dialog
        await openMessageDialog(threadId, listing, listing.user);
        
        // 5. 
        closeModal('detailModal');
        
        console.log('Contact seller succeeded');
        
    } catch (error) {
        console.error('Contact seller failed:', error);
        showError('Contact seller failed: ' + error.message);
    }
}

/**
 * Create or get thread
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

/**
 * Open message dialog
 */
async function openMessageDialog(threadId, listing, seller) {
    try {
        const currentUser = getCurrentUser();
        currentThreadId = threadId;
        currentThread = {
            threadId,
            listing: listing || null,
            buyerId: currentUser?.id || null,
            sellerId: seller?.id || null,
            buyerNickname: currentUser?.nickname || null,
            sellerNickname: seller?.nickname || null
        };
        
        // Fetch listing info from API if missing
        if ((!listing || !listing.meetup_point || !listing.category) && listing?.id) {
            try {
                const freshListing = await getListing(listing.id);
                if (freshListing) {
                    currentThread.listing = freshListing;
                    listing = freshListing;
                }
            } catch (fetchError) {
                console.warn('Failed to complete listing info:', fetchError);
            }
        }
        
        // 1. Update dialog title
        const dialogTitle = document.getElementById('messageDialogTitle');
        if (dialogTitle) {
            const sellerName = getChatPartnerNickname();
            dialogTitle.textContent = sellerName ? `Chat with ${sellerName}` : 'Chat';
        }
        
        // 2. Update listing info
        renderProductInfo(currentThread.listing || listing);
        
        // 3. Load messages
        await loadMessages(threadId);
        
        // 4. Open dialog
        openModal('messageDialog');
        
        // 5. Focus input
        setTimeout(() => {
            const input = document.getElementById('messageInput');
            if (input) input.focus();
        }, 100);
        
    } catch (error) {
        console.error('Failed to open dialog:', error);
        showError('Failed to open dialog: ' + error.message);
    }
}

/**
 * Render listing info
 */
function renderProductInfo(listing) {
    const productInfo = document.getElementById('messageProductInfo');
    if (!productInfo) return;
    if (!listing) {
        productInfo.innerHTML = '';
        return;
    }
    
    const placeholderColor = getColorByCategory(listing.category);
    
    productInfo.innerHTML = `
        <div class="message-product-card">
            <div class="message-product-thumb" style="background:${placeholderColor};">
                ${(listing.title || '').substring(0, 10)}
            </div>
            <div class="message-product-body">
                <div class="message-product-title">${listing.title}</div>
                <div class="message-product-price">$${listing.price}</div>
                <div class="message-product-meta">📍 ${listing.meetup_point || 'Meetup location not set'}</div>
            </div>
        </div>
    `;
}

/**
 * Get color by category
 */
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

/**
 * Close message dialog
 */
function closeMessageDialog() {
    currentThreadId = null;
    currentThread = null;
    if (messageRefreshInterval) {
        clearInterval(messageRefreshInterval);
        messageRefreshInterval = null;
    }
    closeModal('messageDialog');
}

// ===== Message loading and display =====

/**
 * Load messages
 */
async function loadMessages(threadId) {
    try {
        const messagesContainer = document.getElementById('messagesContainer');
        if (!messagesContainer) {
            console.error('Message container missing');
            return;
        }
        
        messagesContainer.innerHTML = '<div class="loading" style="text-align: center; color: #9ca3af; padding: 20px;">Loading messages...</div>';
        
        const response = await fetch(`/api/threads/${threadId}/messages`);
        
        if (!response.ok) {
            throw new Error('Failed to load messages');
        }
        
        const messages = await response.json();
        console.log(':', messages);
        
        if (!messages || messages.length === 0) {
            messagesContainer.innerHTML = '<div style="text-align: center; color: #6b7280; padding: 20px;">Start a new conversation</div>';
        } else {
            messagesContainer.innerHTML = messages.map(msg => renderMessage(msg)).join('');
            
            // 
            setTimeout(() => {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }, 100);
        }
    } catch (error) {
        console.error('Failed to load messages:', error);
        const messagesContainer = document.getElementById('messagesContainer');
        if (messagesContainer) {
            messagesContainer.innerHTML = '<div style="text-align: center; color: #ef4444; padding: 20px;">Failed to load messages</div>';
        }
    }
}

/**
 * Render single message
 */
function renderMessage(message) {
    const currentUser = getCurrentUser();
    const currentUserId = currentUser && currentUser.id ? currentUser.id : null;
    const isOwn = currentUserId ? message.from_user_id === currentUserId : false;
    
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

// =====  =====

/**
 * Send message
 */
async function sendMessage() {
    try {
        const input = document.getElementById('messageInput');
        const content = input.value.trim();
        
        // 1. Validate message content
        if (!content) {
            showError('Please enter message content');
            return;
        }
        
        if (content.length > 1000) {
            showError('Message too long (max 1000 chars)');
            return;
        }
        
        if (!currentThreadId) {
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
        
        // 2. ，Show loading status
        const sendBtn = document.getElementById('messageSendBtn');
        sendBtn.disabled = true;
        sendBtn.textContent = 'Sending...';
        
        // 3. Send message
        console.log('Sending message...', {
            thread_id: currentThreadId,
            from_user_id: currentUser.id,
            to_user_id: receiverId,
            content: content
        });
        
        const response = await fetch('/api/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                thread_id: currentThreadId,
                from_user_id: currentUser.id,
                to_user_id: receiverId,
                content: content
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Send failed');
        }
        
        const result = await response.json();
        console.log('Message sent successfully:', result);
        
        // 4. 
        input.value = '';
        
        // 5. Reload messages
        await loadMessages(currentThreadId);
        
        // 6. 
        sendBtn.disabled = false;
        sendBtn.textContent = '';
        
    } catch (error) {
        console.error('Failed to send message:', error);
        showError('Failed to send message: ' + error.message);
        
        // 
        const sendBtn = document.getElementById('messageSendBtn');
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.textContent = '';
        }
    }
}

/**
 * Get chat object ID
 */
function getChatPartnerId() {
    if (!currentThread) return null;
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.id) return null;
    
    if (currentUser.id === currentThread.buyerId) {
        return currentThread.sellerId;
    }
    if (currentUser.id === currentThread.sellerId) {
        return currentThread.buyerId;
    }
    return null;
}

/**
 * Get chat object name
 */
function getChatPartnerNickname() {
    if (!currentThread) return null;
    if (currentThread.sellerNickname) return currentThread.sellerNickname;
    if (currentThread.listing && currentThread.listing.user && currentThread.listing.user.nickname) {
        return currentThread.listing.user.nickname;
    }
    return 'Seller';
}

// ===== Message list page =====

/**
 * Load messages page (all threads)
 */
async function loadMessagesPage() {
    try {
        const currentUser = getCurrentUser();
        const threadList = document.getElementById('threadList');
        
        if (!threadList) {
            console.error('Thread container missing');
            return;
        }
        
        if (!currentUser || !currentUser.id) {
            threadList.innerHTML = '<div style="text-align: center; color: #6b7280; padding: 40px;">Please log in to view messages</div>';
            return;
        }
        
        threadList.innerHTML = '<div style="text-align: center; color: #9ca3af; padding: 40px;">Loading...</div>';
        
        const response = await fetch(`/api/threads/${currentUser.id}`);
        
        if (!response.ok) {
            throw new Error('Load failed');
        }
        
        const threads = await response.json();
        console.log(':', threads);
        
        if (!threads || threads.length === 0) {
            threadList.innerHTML = '<div style="text-align: center; color: #6b7280; padding: 40px;">💬<br>No messages</div>';
            return;
        }
        
        threadList.innerHTML = threads.map(thread => renderThreadItem(thread)).join('');
        
    } catch (error) {
        console.error('Load messages:', error);
        const threadList = document.getElementById('threadList');
        if (threadList) {
            threadList.innerHTML = '<div style="text-align: center; color: #ef4444; padding: 40px;">Load messages</div>';
        }
    }
}

/**
 * Render thread item
 */
function renderThreadItem(thread) {
    const currentUser = getCurrentUser();
    const isBuyer = currentUser && currentUser.id === thread.buyer_id;
    const otherNickname = isBuyer
        ? (thread.seller_nickname || 'Seller')
        : (thread.buyer_nickname || '');
    
    return `
        <div class="thread-item" onclick="openThreadFromList(${thread.id})">
            <div class="thread-header">
                <div class="thread-title">${otherNickname}</div>
                <div class="thread-time">${formatTime(thread.last_message_at)}</div>
            </div>
            <div class="thread-preview">${thread.listing_title}</div>
            <div class="thread-price">$${thread.listing_price}</div>
        </div>
    `;
}

/**
 * Open thread from message list
 */
async function openThreadFromList(threadId) {
    try {
        const currentUser = getCurrentUser();
        if (!currentUser || !currentUser.id) {
            showError('Login');
            return;
        }
        
        currentThreadId = threadId;
        
        // 
        const response = await fetch(`/api/threads/${threadId}`);
        if (!response.ok) {
            throw new Error('');
        }
        
        const thread = await response.json();
        
        currentThread = {
            threadId,
            listing: {
                id: thread.listing_id,
                title: thread.listing_title,
                price: thread.listing_price,
                meetup_point: thread.listing_meetup_point || thread.meetup_point || '',
                category: thread.listing_category || 'other'
            },
            buyerId: thread.buyer_id,
            sellerId: thread.seller_id,
            buyerNickname: thread.buyer_nickname,
            sellerNickname: thread.seller_nickname
        };
        currentThreadId = threadId;
        
        // 
        const dialogTitle = document.getElementById('messageDialogTitle');
        if (dialogTitle) {
            const sellerName = thread.seller_nickname || 'Seller';
            dialogTitle.textContent = `Chat with ${sellerName}`;
        }
        
        // Update listing info
        const productInfo = document.getElementById('messageProductInfo');
        if (productInfo) {
            productInfo.innerHTML = `
                <div class="message-product-card">
                    <div class="message-product-thumb">
                        ${(thread.listing_title || '').substring(0, 10)}
                    </div>
                    <div class="message-product-body">
                        <div class="message-product-title">${thread.listing_title}</div>
                        <div class="message-product-price">$${thread.listing_price}</div>
                        <div class="message-product-meta">📍 ${thread.listing_meetup_point || 'Meetup location not set'}</div>
                    </div>
                </div>
            `;
        }

        // 
        await loadMessages(threadId);
        
        // Open dialog
        openModal('messageDialog');
        
    } catch (error) {
        console.error('Failed to open thread:', error);
        showError('Failed to open thread');
    }
}

// =====  =====

/**
 * Get listing info
 */
async function getListing(listingId) {
    try {
        // Check local state first
        const currentState = getState();
        let listing = currentState.listings.find(l => l.id === listingId);
        
        // Fetch from API if not local
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

/**
 * Format time
 */
function formatTime(dateString) {
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        
        // Less than a minute
        if (diff < 60000) {
            return 'Just now';
        }
        // 1
        if (diff < 3600000) {
            return Math.floor(diff / 60000) + ' minutes ago';
        }
        // 1
        if (diff < 86400000) {
            return Math.floor(diff / 3600000) + ' hours ago';
        }
        
        // Show date and time
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${date.getMonth() + 1}/${date.getDate()} ${hours}:${minutes}`;
    } catch (e) {
        console.error('Time formatting failed:', e);
        return dateString;
    }
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Show error message
 */
function showError(message) {
    alert('❌ ' + message);
}

// =====  =====

/**
 * Initialize contact seller feature
 */
function initContactSeller() {
    console.log('✓ Contact seller initialized');
    
    // Add Enter shortcut to message input
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initContactSeller);
} else {
    initContactSeller();
}
