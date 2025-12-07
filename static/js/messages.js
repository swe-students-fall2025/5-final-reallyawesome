// ================================
// Messages Subsystem (Frontend)
// Aligns with backend endpoints in services/api/app.py
// ================================

// State
let currentThreadId = null;
let currentUserId = null;

function getCurrentUserId() {
    if (typeof getCurrentUser === "function") {
        const user = getCurrentUser();
        if (user && user.id) {
            currentUserId = user.id;
            return user.id;
        }
    }
    if (window.loggedInUserId) {
        currentUserId = window.loggedInUserId;
        return window.loggedInUserId;
    }
    return null;
}

// ===============
// API Helpers
// ===============

async function apiGetThreadList() {
    const userId = getCurrentUserId();
    if (!userId) {
        return [];
    }
    const res = await fetch(`/api/threads/${userId}`);
    if (!res.ok) {
        throw new Error("Failed to load threads");
    }
    return await res.json();
}

async function apiGetMessages(threadId) {
    const res = await fetch(`/api/threads/${threadId}/messages`);
    if (!res.ok) {
        throw new Error("Failed to load messages");
    }
    return await res.json();
}

async function apiSendMessage(threadId, content) {
    const senderId = getCurrentUserId();
    if (!senderId) {
        throw new Error("Please log in");
    }
    const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            thread_id: threadId,
            sender_id: senderId,
            content: content
        })
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to send message");
    }
    return await res.json();
}

// ================================
// UI Helpers
// ================================

function showThreadListPage() {
    document.getElementById("threadListPage").style.display = "block";
    document.getElementById("chatPage").style.display = "none";
}

function showChatPage() {
    document.getElementById("threadListPage").style.display = "none";
    document.getElementById("chatPage").style.display = "block";
}

function backToThreads() {
    showThreadListPage();
    currentThreadId = null;
}

// ================================
// Thread List
// ================================

async function loadThreadList() {
    const container = document.getElementById("threadList");
    if (!container) return;

    const userId = getCurrentUserId();
    if (!userId) {
        container.innerHTML = `
            <div class="empty-placeholder">
                🔐<br>Please log in to view messages
            </div>`;
        return;
    }

    container.innerHTML = `<div class="loading">Loading...</div>`;

    try {
        const list = await apiGetThreadList();

        if (!list || list.length === 0) {
            container.innerHTML = `
                <div class="empty-placeholder">
                    💬<br>No conversations yet
                </div>`;
            return;
        }

        const userCache = new Map();

        // Enrich with listing and participant names for display
        const enriched = await Promise.all(
            list.map(async (thread) => {
                let listing = null;
                try {
                    listing = await API.getListing(thread.listing_id);
                } catch (_err) {
                    // ignore listing fetch failures; fallback to id only
                }
                const otherUserId = thread.buyer_id === String(userId) ? thread.seller_id : thread.buyer_id;
                let otherUserName = "User";

                if (otherUserId) {
                    // Prefer listing owner name when available
                    if (listing?.user && String(listing.user.id) === String(otherUserId)) {
                        otherUserName = listing.user.nickname || listing.user.name || listing.user.username || `User ${otherUserId}`;
                    } else if (userCache.has(otherUserId)) {
                        otherUserName = userCache.get(otherUserId);
                    } else {
                        try {
                            const userProfile = await API.getUser(otherUserId);
                            otherUserName = userProfile.nickname || userProfile.name || userProfile.username || `User ${otherUserId}`;
                            userCache.set(otherUserId, otherUserName);
                        } catch (_err) {
                            otherUserName = `User ${otherUserId}`;
                        }
                    }
                }

                return { ...thread, listing, otherUserId, otherUserName };
            })
        );

        container.innerHTML = "";
        enriched.forEach(thread => {
            const div = document.createElement("div");
            div.className = "thread-item";

            const title = thread.listing?.title || `Listing ${thread.listing_id}`;
            const price = thread.listing?.price ? `$${thread.listing.price}` : "";
            const otherUserLabel = thread.otherUserName || "User";

            div.innerHTML = `
                <div class="thread-item-summary">
                    <div class="thread-item-title">${otherUserLabel}</div>
                    <div class="thread-item-lastmsg">${title} ${price}</div>
                </div>
            `;

            div.onclick = () => openChat(thread.id, thread.listing);
            container.appendChild(div);
        });
    } catch (error) {
        console.error("Failed to load threads:", error);
        container.innerHTML = `
            <div class="empty-placeholder">
                ⚠️ Failed to load conversations
            </div>`;
    }
}

// ================================
// Chat Page
// ================================

// 打开聊天界面
async function openChat(threadId, productInfo) {
    currentThreadId = threadId;

    // If unified chat modal exists (contact_seller), reuse it
    if (typeof openMessageDialog === "function") {
        let listing = productInfo || null;
        if (!listing) {
            try {
                // Find thread and fetch listing info
                const threads = await apiGetThreadList();
                const match = threads.find(t => String(t.id) === String(threadId) || String(t.thread_id) === String(threadId));
                if (match) {
                    listing = await API.getListing(match.listing_id);
                }
            } catch (_err) {
                listing = null;
            }
        }
        openMessageDialog(threadId, listing || null, listing?.user || null);
        return;
    }

    // Fallback to page-based chat
    showChatPage();

    if (productInfo) {
        document.getElementById("chatProductInfo").style.display = "block";
        document.getElementById("chatProductTitle").innerText = productInfo.title || "";
        document.getElementById("chatProductPrice").innerText = productInfo.price || "";
        if (productInfo.thumbnail) {
            document.getElementById("chatProductThumb").innerHTML =
                `<img src="${productInfo.thumbnail}" style="width:100%;height:100%;object-fit:cover;">`;
        }
    }

    if (!productInfo && threadId) {
        try {
            const messages = await apiGetMessages(threadId);
            if (messages && messages.length && messages[0].listing_id) {
                productInfo = await API.getListing(messages[0].listing_id);
            }
        } catch (_err) {
            // ignore
        }
    }

    loadMessages();
}

// 加载消息
async function loadMessages() {
    if (!currentThreadId) return;

    let messages = [];
    try {
        messages = await apiGetMessages(currentThreadId);
    } catch (error) {
        console.error("Failed to load messages:", error);
        document.getElementById("messagesScroll").innerHTML = `
            <div class="empty-placeholder">Failed to load messages</div>
        `;
        return;
    }
    const box = document.getElementById("messagesScroll");

    box.innerHTML = "";

    messages.forEach(msg => {
        const div = document.createElement("div");
        div.className =
            "message-bubble " +
            (String(msg.sender_id) === String(currentUserId) ? "message-me" : "message-other");

        div.innerText = msg.content;
        box.appendChild(div);
    });

    // 自动滚动到底部
    box.scrollTop = box.scrollHeight;
}

// ================================
// 发送消息
// ================================

async function sendMessage() {
    const input = document.getElementById("chatInput");
    const text = input.value.trim();

    if (!text || !currentThreadId) return;

    try {
        await apiSendMessage(currentThreadId, text);
    } catch (error) {
        console.error("Failed to send message:", error);
        alert(error.message || "Failed to send message");
        return;
    }

    // 清空输入框
    input.value = "";

    // 重新加载消息
    loadMessages();
}

// ================================
// 初始化（当用户点击 Messages Tab 时调用）
// ================================

function initMessagesPage() {
    showThreadListPage();
    loadThreadList();
}

// 你们已有 UI 切换函数里应该调用这个：
// if (tab === "messages") initMessagesPage();
