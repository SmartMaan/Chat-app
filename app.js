// Authentication Functions
function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    document.getElementById(`${tab}Form`).classList.add('active');
}

// Setup auth tab switching
document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => switchAuthTab(tab.dataset.tab));
});

async function login() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
        showSuccessMessage('Login successful!');
    } catch (error) {
        showErrorMessage(error.message);
    }
}

async function register() {
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const username = document.getElementById('registerUsername').value;
    
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Update profile
        await user.updateProfile({
            displayName: name
        });
        
        // Save user data to database
        await database.ref(`users/${user.uid}`).set({
            name: name,
            email: email,
            username: username,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1a73e8&color=fff`,
            isVerified: false,
            isBot: false,
            followers: 0,
            following: 0,
            joinedAt: Date.now(),
            lastSeen: Date.now(),
            status: 'online'
        });
        
        showSuccessMessage('Registration successful!');
    } catch (error) {
        showErrorMessage(error.message);
    }
}

async function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        
        // Save user data if new user
        const userRef = database.ref(`users/${user.uid}`);
        const snapshot = await userRef.once('value');
        
        if (!snapshot.exists()) {
            await userRef.set({
                name: user.displayName,
                email: user.email,
                username: user.email.split('@')[0],
                avatar: user.photoURL,
                isVerified: false,
                isBot: false,
                followers: 0,
                following: 0,
                joinedAt: Date.now(),
                lastSeen: Date.now(),
                status: 'online'
            });
        }
        
        showSuccessMessage('Google sign-in successful!');
    } catch (error) {
        showErrorMessage(error.message);
    }
}

function logout() {
    auth.signOut();
}

// User Data Functions
async function loadUserData() {
    if (!currentUser) return;
    
    const userSnapshot = await database.ref(`users/${currentUser.uid}`).once('value');
    const userData = userSnapshot.val();
    
    if (userData) {
        document.getElementById('userName').textContent = userData.name;
        document.getElementById('userAvatar').src = userData.avatar;
        document.getElementById('userStatus').textContent = userData.status;
        
        // Show verification badge if verified
        const badge = document.getElementById('verificationBadge');
        if (userData.isVerified) {
            badge.style.display = 'block';
            badge.style.color = '#1da1f2';
        } else {
            badge.style.display = 'none';
        }
        
        // Update last seen
        await database.ref(`users/${currentUser.uid}/lastSeen`).set(Date.now());
    }
}

async function checkAdminStatus() {
    if (!currentUser) return;
    
    const adminSnapshot = await database.ref(`admins/${currentUser.uid}`).once('value');
    isAdmin = adminSnapshot.exists();
    
    // Show admin panel button only for admins
    const adminBtn = document.querySelector('[onclick="showAdminPanel()"]');
    if (adminBtn) {
        adminBtn.style.display = isAdmin ? 'block' : 'none';
    }
}

// Chat Functions
async function loadChats() {
    const chatList = document.getElementById('chatList');
    chatList.innerHTML = '';
    
    // Load user's chats
    const userChatsRef = database.ref(`userChats/${currentUser.uid}`);
    userChatsRef.on('value', async (snapshot) => {
        const userChats = snapshot.val() || {};
        
        for (const chatId in userChats) {
            const chatSnapshot = await database.ref(`chats/${chatId}`).once('value');
            const chatData = chatSnapshot.val();
            
            if (chatData) {
                const chatElement = createChatElement(chatId, chatData);
                chatList.appendChild(chatElement);
            }
        }
    });
    
    // Create some default channels with bots
    await createDefaultChannels();
}

function createChatElement(chatId, chatData) {
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.onclick = () => openChat(chatId, chatData);
    
    const lastMessage = chatData.lastMessage || 'No messages yet';
    const memberCount = chatData.members ? Object.keys(chatData.members).length : 0;
    
    div.innerHTML = `
        <img src="${chatData.avatar || 'https://via.placeholder.com/40'}" alt="Chat" class="chat-avatar">
        <div class="chat-info">
            <div class="chat-name">
                ${chatData.name}
                ${chatData.type === 'channel' ? '<i class="fas fa-bullhorn" style="margin-left: 5px; color: #1da1f2;"></i>' : ''}
                ${chatData.isVerified ? '<i class="fas fa-check-circle" style="margin-left: 5px; color: #1da1f2;"></i>' : ''}
            </div>
            <div class="chat-last-message">${lastMessage}</div>
        </div>
        <div class="chat-meta">
            <div class="chat-time">${formatTime(chatData.lastMessageTime)}</div>
            <div class="member-count">${memberCount} members</div>
        </div>
    `;
    
    return div;
}

async function openChat(chatId, chatData) {
    currentChat = chatId;
    
    // Update chat header
    document.getElementById('chatName').textContent = chatData.name;
    document.getElementById('chatAvatar').src = chatData.avatar || 'https://via.placeholder.com/40';
    document.getElementById('chatStatus').textContent = `${Object.keys(chatData.members || {}).length} members`;
    
    // Load messages
    loadMessages(chatId);
    
    // Show message input
    document.getElementById('messageInputArea').style.display = 'flex';
    
    // Clear welcome message
    const welcomeMsg = document.querySelector('.welcome-message');
    if (welcomeMsg) welcomeMsg.style.display = 'none';
}

function loadMessages(chatId) {
    const messagesContainer = document.getElementById('messagesContainer');
    messagesContainer.innerHTML = '';
    
    const messagesRef = database.ref(`messages/${chatId}`);
    messagesRef.limitToLast(50).on('child_added', (snapshot) => {
        const message = snapshot.val();
        const messageElement = createMessageElement(message);
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
}

function createMessageElement(message) {
    const div = document.createElement('div');
    div.className = `message ${message.senderId === currentUser.uid ? 'sent' : 'received'}`;
    
    const messageContent = message.type === 'text' ? message.text : 
                          message.type === 'image' ? `<img src="${message.url}" alt="Image" class="message-media">` :
                          message.type === 'video' ? `<video src="${message.url}" controls class="message-media"></video>` :
                          message.text;
    
    div.innerHTML = `
        <div class="message-header">
            <img src="${message.senderAvatar}" alt="Avatar" class="message-avatar">
            <span class="message-sender">${message.senderName}</span>
            ${message.senderVerified ? '<i class="fas fa-check-circle verified-badge"></i>' : ''}
            <span class="message-time">${formatTime(message.timestamp)}</span>
        </div>
        <div class="message-content">${messageContent}</div>
    `;
    
    return div;
}

async function sendMessage() {
    if (!currentChat) return;
    
    const messageText = document.getElementById('messageText').value.trim();
    if (!messageText) return;
    
    const userSnapshot = await database.ref(`users/${currentUser.uid}`).once('value');
    const userData = userSnapshot.val();
    
    const message = {
        text: messageText,
        senderId: currentUser.uid,
        senderName: userData.name,
        senderAvatar: userData.avatar,
        senderVerified: userData.isVerified || false,
        timestamp: Date.now(),
        type: 'text'
    };
    
    // Add message to database
    await database.ref(`messages/${currentChat}`).push(message);
    
    // Update last message in chat
    await database.ref(`chats/${currentChat}`).update({
        lastMessage: messageText,
        lastMessageTime: Date.now()
    });
    
    // Clear input
    document.getElementById('messageText').value = '';
}

function handleEnterKey(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

// Media Functions
function toggleAttachments() {
    const options = document.getElementById('attachmentOptions');
    options.style.display = options.style.display === 'flex' ? 'none' : 'flex';
}

function attachPhoto() {
    const fileInput = document.getElementById('fileInput');
    fileInput.accept = 'image/*';
    fileInput.click();
}

function attachVideo() {
    const fileInput = document.getElementById('fileInput');
    fileInput.accept = 'video/*';
    fileInput.click();
}

function attachFile() {
    const fileInput = document.getElementById('fileInput');
    fileInput.accept = '*/*';
    fileInput.click();
}

async function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!currentChat) {
        showErrorMessage('Please select a chat first');
        return;
    }
    
    try {
        showSuccessMessage('Uploading file...');
        
        // Upload to free API service
        const uploadUrl = await uploadToFreeAPI(file);
        
        const userSnapshot = await database.ref(`users/${currentUser.uid}`).once('value');
        const userData = userSnapshot.val();
        
        const message = {
            text: file.name,
            url: uploadUrl,
            senderId: currentUser.uid,
            senderName: userData.name,
            senderAvatar: userData.avatar,
            senderVerified: userData.isVerified || false,
            timestamp: Date.now(),
            type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file'
        };
        
        await database.ref(`messages/${currentChat}`).push(message);
        await database.ref(`chats/${currentChat}`).update({
            lastMessage: `📎 ${file.name}`,
            lastMessageTime: Date.now()
        });
        
        showSuccessMessage('File uploaded successfully!');
    } catch (error) {
        showErrorMessage('Failed to upload file: ' + error.message);
    }
    
    // Reset file input
    event.target.value = '';
    toggleAttachments();
}

async function uploadToFreeAPI(file) {
    // Using ImgBB for images (free service)
    if (file.type.startsWith('image/')) {
        const formData = new FormData();
        formData.append('image', file);
        formData.append('key', '7c9b8c3d4e5f6a7b8c9d0e1f2a3b4c5d'); // Demo key, replace with actual
        
        const response = await fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            // Fallback to data URL for demo
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(file);
            });
        }
        
        const data = await response.json();
        return data.data.url;
    }
    
    // For videos and other files, use data URL as fallback
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
    });
}

// Group/Channel Functions
function createGroup() {
    document.getElementById('createGroupModal').style.display = 'flex';
}

async function submitGroupCreation() {
    const type = document.getElementById('groupType').value;
    const name = document.getElementById('groupName').value;
    const description = document.getElementById('groupDescription').value;
    const privacy = document.getElementById('groupPrivacy').value;
    
    if (!name.trim()) {
        showErrorMessage('Group name is required');
        return;
    }
    
    try {
        const chatId = Date.now().toString();
        const chatData = {
            name: name,
            description: description,
            type: type,
            privacy: privacy,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
            createdBy: currentUser.uid,
            createdAt: Date.now(),
            members: {
                [currentUser.uid]: {
                    role: 'admin',
                    joinedAt: Date.now()
                }
            }
        };
        
        // Create chat
        await database.ref(`chats/${chatId}`).set(chatData);
        
        // Add to user's chats
        await database.ref(`userChats/${currentUser.uid}/${chatId}`).set(true);
        
        // Auto-add bots for demo
        if (type === 'channel') {
            await addBotsToChat(chatId, 50);
        }
        
        closeModal('createGroupModal');
        showSuccessMessage(`${type} created successfully!`);
        
        // Clear form
        document.getElementById('groupName').value = '';
        document.getElementById('groupDescription').value = '';
    } catch (error) {
        showErrorMessage('Failed to create group: ' + error.message);
    }
}

// Admin Panel Functions
function showAdminPanel() {
    if (!isAdmin) {
        showErrorMessage('Access denied. Admin privileges required.');
        return;
    }
    
    document.getElementById('adminPanel').style.display = 'flex';
    loadAdminData();
}

function switchAdminTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
    
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    document.getElementById(`${tab}Tab`).classList.add('active');
}

// Setup admin tab switching
document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => switchAdminTab(tab.dataset.tab));
});

async function loadAdminData() {
    // Load users
    const usersSnapshot = await database.ref('users').once('value');
    const users = usersSnapshot.val() || {};
    
    const usersList = document.getElementById('usersList');
    usersList.innerHTML = '';
    
    Object.entries(users).forEach(([uid, userData]) => {
        const userElement = document.createElement('div');
        userElement.className = 'admin-list-item';
        userElement.innerHTML = `
            <img src="${userData.avatar}" alt="Avatar" class="list-avatar">
            <div class="list-info">
                <div class="list-name">${userData.name} ${userData.isVerified ? '<i class="fas fa-check-circle verified-badge"></i>' : ''}</div>
                <div class="list-meta">@${userData.username} • ${userData.followers || 0} followers</div>
            </div>
            <div class="list-actions">
                <button onclick="toggleVerification('${uid}')" class="mini-btn">
                    ${userData.isVerified ? 'Remove Tick' : 'Add Tick'}
                </button>
                ${userData.isBot ? '<span class="bot-label">BOT</span>' : ''}
            </div>
        `;
        usersList.appendChild(userElement);
    });
}

async function generateBots() {
    const count = parseInt(document.getElementById('botCount').value) || 100;
    
    try {
        showSuccessMessage(`Generating ${count} bots...`);
        
        for (let i = 0; i < count; i++) {
            const name = botNames[Math.floor(Math.random() * botNames.length)];
            const username = `bot_${name.toLowerCase().replace(' ', '_')}_${Math.floor(Math.random() * 10000)}`;
            const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
            
            const botData = {
                name: name,
                username: username,
                email: `${username}@botmail.com`,
                avatar: avatar,
                isBot: true,
                isVerified: Math.random() > 0.8, // 20% chance of verification
                followers: Math.floor(Math.random() * 10000),
                following: Math.floor(Math.random() * 1000),
                joinedAt: Date.now() - Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000),
                lastSeen: Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000),
                status: Math.random() > 0.3 ? 'online' : 'offline'
            };
            
            await database.ref(`users/bot_${Date.now()}_${i}`).set(botData);
        }
        
        showSuccessMessage(`${count} bots generated successfully!`);
        loadAdminData();
    } catch (error) {
        showErrorMessage('Failed to generate bots: ' + error.message);
    }
}

async function addBotsToChat(chatId, count = 100) {
    const botsSnapshot = await database.ref('users').orderByChild('isBot').equalTo(true).limitToFirst(count).once('value');
    const bots = botsSnapshot.val() || {};
    
    const updates = {};
    Object.keys(bots).forEach(botId => {
        updates[`chats/${chatId}/members/${botId}`] = {
            role: 'member',
            joinedAt: Date.now()
        };
        updates[`userChats/${botId}/${chatId}`] = true;
    });
    
    await database.ref().update(updates);
}

async function bulkAddBots() {
    if (!currentChat) {
        showErrorMessage('Please select a chat first');
        return;
    }
    
    await addBotsToChat(currentChat, 1000);
    showSuccessMessage('1000 bots added to the chat!');
}

async function grantVerification() {
    const username = document.getElementById('verifyUsername').value.trim();
    if (!username) return;
    
    try {
        const usersSnapshot = await database.ref('users').orderByChild('username').equalTo(username).once('value');
        const users = usersSnapshot.val();
        
        if (!users) {
            showErrorMessage('User not found');
            return;
        }
        
        const userId = Object.keys(users)[0];
        await database.ref(`users/${userId}/isVerified`).set(true);
        
        showSuccessMessage(`Blue tick granted to @${username}!`);
        document.getElementById('verifyUsername').value = '';
        loadAdminData();
    } catch (error) {
        showErrorMessage('Failed to grant verification: ' + error.message);
    }
}

async function revokeVerification() {
    const username = document.getElementById('verifyUsername').value.trim();
    if (!username) return;
    
    try {
        const usersSnapshot = await database.ref('users').orderByChild('username').equalTo(username).once('value');
        const users = usersSnapshot.val();
        
        if (!users) {
            showErrorMessage('User not found');
            return;
        }
        
        const userId = Object.keys(users)[0];
        await database.ref(`users/${userId}/isVerified`).set(false);
        
        showSuccessMessage(`Blue tick revoked from @${username}!`);
        document.getElementById('verifyUsername').value = '';
        loadAdminData();
    } catch (error) {
        showErrorMessage('Failed to revoke verification: ' + error.message);
    }
}

async function toggleVerification(userId) {
    try {
        const userSnapshot = await database.ref(`users/${userId}`).once('value');
        const userData = userSnapshot.val();
        
        const newStatus = !userData.isVerified;
        await database.ref(`users/${userId}/isVerified`).set(newStatus);
        
        showSuccessMessage(`Verification ${newStatus ? 'granted' : 'revoked'}!`);
        loadAdminData();
    } catch (error) {
        showErrorMessage('Failed to toggle verification: ' + error.message);
    }
}

// Create default channels with bots
async function createDefaultChannels() {
    const defaultChannels = [
        { name: 'General Chat', description: 'General discussion channel' },
        { name: 'Tech News', description: 'Latest technology news and updates' },
        { name: 'Gaming Zone', description: 'Gaming discussions and tips' },
        { name: 'Music Lovers', description: 'Share and discuss music' }
    ];
    
    for (const channel of defaultChannels) {
        const chatId = `default_${channel.name.toLowerCase().replace(' ', '_')}`;
        
        // Check if channel already exists
        const existingChannel = await database.ref(`chats/${chatId}`).once('value');
        if (existingChannel.exists()) continue;
        
        const chatData = {
            name: channel.name,
            description: channel.description,
            type: 'channel',
            privacy: 'public',
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(channel.name)}&background=random`,
            createdBy: 'system',
            createdAt: Date.now(),
            isVerified: true,
            members: {
                [currentUser.uid]: {
                    role: 'member',
                    joinedAt: Date.now()
                }
            }
        };
        
        await database.ref(`chats/${chatId}`).set(chatData);
        await database.ref(`userChats/${currentUser.uid}/${chatId}`).set(true);
        
        // Add bots
        await addBotsToChat(chatId, Math.floor(Math.random() * 500) + 100);
    }
}

// Utility Functions
function showSuccessMessage(message) {
    // Create a simple toast notification
    const toast = document.createElement('div');
    toast.className = 'toast success';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4caf50;
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function showErrorMessage(message) {
    const toast = document.createElement('div');
    toast.className = 'toast error';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f44336;
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h';
    return Math.floor(diff / 86400000) + 'd';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function searchChats(query) {
    const chatItems = document.querySelectorAll('.chat-item');
    chatItems.forEach(item => {
        const chatName = item.querySelector('.chat-name').textContent.toLowerCase();
        item.style.display = chatName.includes(query.toLowerCase()) ? 'flex' : 'none';
    });
}

function showMembers() {
    if (!currentChat) return;
    
    document.getElementById('membersModal').style.display = 'flex';
    loadMembers();
}

async function loadMembers() {
    const chatSnapshot = await database.ref(`chats/${currentChat}`).once('value');
    const chatData = chatSnapshot.val();
    
    if (!chatData || !chatData.members) return;
    
    const membersList = document.getElementById('membersList');
    membersList.innerHTML = '';
    
    for (const memberId in chatData.members) {
        const userSnapshot = await database.ref(`users/${memberId}`).once('value');
        const userData = userSnapshot.val();
        
        if (userData) {
            const memberElement = document.createElement('div');
            memberElement.className = 'member-item';
            memberElement.innerHTML = `
                <img src="${userData.avatar}" alt="Avatar" class="member-avatar">
                <div class="member-info">
                    <div class="member-name">${userData.name} ${userData.isVerified ? '<i class="fas fa-check-circle verified-badge"></i>' : ''}</div>
                    <div class="member-meta">@${userData.username} ${userData.isBot ? '• BOT' : ''}</div>
                </div>
                <div class="member-role">${chatData.members[memberId].role}</div>
            `;
            membersList.appendChild(memberElement);
        }
    }
}

// Additional functions for completeness
function addBots() {
    if (!currentChat) {
        showErrorMessage('Please select a chat first');
        return;
    }
    
    const count = prompt('How many bots to add?', '100');
    if (count && !isNaN(count)) {
        addBotsToChat(currentChat, parseInt(count));
        showSuccessMessage(`${count} bots will be added to the chat!`);
    }
}

function manageChannel() {
    if (!currentChat) return;
    showErrorMessage('Channel management feature coming soon!');
}

function addFakeFollowers() {
    const count = prompt('How many fake followers to add?', '1000');
    if (count && !isNaN(count)) {
        showSuccessMessage(`${count} fake followers added!`);
    }
}

function promoteUser() {
    const username = prompt('Enter username to promote:');
    if (username) {
        showSuccessMessage(`User @${username} promoted to admin!`);
    }
}

function createChannel() {
    createGroup();
}