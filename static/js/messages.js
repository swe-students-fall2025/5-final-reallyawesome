// ================================
// Messages Subsystem (Frontend)
// ================================

// 全局状态
let currentThreadId = null;
let currentUserId = window.loggedInUserId || null;

// ===============
// API Helpers
// ===============

async function apiGetThreadList() {
    const res = await fetch("/api/message_threads");
    return await res.json();
}

async function apiGetMessages(threadId) {
    const res = await fetch(`/api/messages/${threadId}`);
    return await res.json();
}

async function apiSendMessage(threadId, content) {
    await fetch(`/api/messages/${threadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            sender_id: currentUserId,
            content: content
        })
    });
}

// ================================
// UI Helpers
// ================================

// 切换页面
function showThreadListPage() {
    document.getElementById("threadListPage").style.display = "block";
    document.getElementById("chatPage").style.display = "none";
}

function showChatPage() {
    document.getElementById("threadListPage").style.display = "none";
    document.getElementById("chatPage").style.display = "block";
}

// 返回线程列表
function backToThreads() {
    showThreadListPage();
    currentThreadId = null;
}

// ================================
// Thread List
// ================================

async function loadThreadList() {
    const list = await apiGetThreadList();
    const container = document.getElementById("threadList");
    container.innerHTML = "";

    if (list.length === 0) {
        container.innerHTML = `
            <div class="empty-placeholder">
                💬<br>No conversations yet
            </div>`;
        return;
    }

    list.forEach(thread => {
        const div = document.createElement("div");
        div.className = "thread-item";

        div.innerHTML = `
            <div class="thread-item-summary">
                <div class="thread-item-title">${thread.other_user_name || "User"}</div>
                <div class="thread-item-lastmsg">${thread.last_message || ""}</div>
            </div>
        `;

        div.onclick = () => openChat(thread.thread_id, thread.product);
        container.appendChild(div);
    });
}

// ================================
// Chat Page
// ================================

// 打开聊天界面
function openChat(threadId, productInfo) {
    currentThreadId = threadId;

    // 切换页面
    showChatPage();

    // 商品信息（如果有）
    if (productInfo) {
        document.getElementById("chatProductInfo").style.display = "block";
        document.getElementById("chatProductTitle").innerText = productInfo.title || "";
        document.getElementById("chatProductPrice").innerText = productInfo.price || "";
        if (productInfo.thumbnail) {
            document.getElementById("chatProductThumb").innerHTML =
                `<img src="${productInfo.thumbnail}" style="width:100%;height:100%;object-fit:cover;">`;
        }
    }

    loadMessages();
}

// 加载消息
async function loadMessages() {
    if (!currentThreadId) return;

    const messages = await apiGetMessages(currentThreadId);
    const box = document.getElementById("messagesScroll");

    box.innerHTML = "";

    messages.forEach(msg => {
        const div = document.createElement("div");
        div.className =
            "message-bubble " +
            (msg.sender_id === currentUserId ? "message-me" : "message-other");

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

    // 发送
    await apiSendMessage(currentThreadId, text);

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
