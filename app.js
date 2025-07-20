// Firebase configuration is loaded from firebase-config.js

// Global variables
let currentUser = null;
let currentChat = null;
let isAdmin = false;
let isSidebarOpen = false;

// Mobile-specific variables
let currentSearchFilter = 'all';
let currentDiscoveryFilter = 'all';
let friendRequestsCache = {};
let friendsCache = {};

// Bot names for generating fake users
const botNames = [
    'Alex Johnson', 'Maria Garcia', 'David Wilson', 'Sarah Brown', 'Michael Davis',
    'Jessica Miller', 'Christopher Wilson', 'Amanda Johnson', 'Matthew Taylor', 'Ashley Anderson',
    'Joshua Jackson', 'Brittany White', 'Andrew Thomas', 'Samantha Harris', 'Justin Martin',
    'Megan Thompson', 'Ryan Garcia', 'Lauren Martinez', 'Brandon Rodriguez', 'Kayla Lewis',
    'Tyler Lee', 'Nicole Walker', 'Kevin Hall', 'Danielle Allen', 'Jose Young',
    'Stephanie Hernandez', 'Jacob King', 'Rachel Wright', 'Aaron Lopez', 'Christina Hill',
    'Zachary Scott', 'Michelle Green', 'Nathan Adams', 'Kimberly Baker', 'Caleb Gonzalez',
    'Amy Nelson', 'Noah Carter', 'Elizabeth Mitchell', 'Ethan Perez', 'Melissa Roberts',
    'Lucas Turner', 'Laura Phillips', 'Mason Campbell', 'Rebecca Parker', 'Logan Evans',
    'Anna Edwards', 'Hunter Collins', 'Victoria Stewart', 'Connor Sanchez', 'Olivia Morris'
];

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', function() {
    showLoadingScreen();
    
    // Setup mobile interactions
    setupMobileInteractions();
    
    // Check authentication state
    auth.onAuthStateChanged(function(user) {
        hideLoadingScreen();
        if (user) {
            currentUser = user;
            checkAdminStatus();
            showMainApp();
            loadUserData();
            loadChats();
        } else {
            showAuthScreen();
        }
    });
});

// Mobile-specific setup
function setupMobileInteractions() {
    // Setup auth tab switching
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => switchAuthTab(tab.dataset.tab));
    });

    // Setup chat tab switching
    document.querySelectorAll('.chat-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.chat-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Prevent double-tap zoom on mobile
    let lastTouchEnd = 0;
    document.addEventListener('touchend', function (event) {
        const now = (new Date()).getTime();
        if (now - lastTouchEnd <= 300) {
            event.preventDefault();
        }
        lastTouchEnd = now;
    }, false);

    // Handle swipe gestures for sidebar
    setupSwipeGestures();

    // Auto-resize textarea for message input
    const messageText = document.getElementById('messageText');
    if (messageText) {
        messageText.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 120) + 'px';
        });
    }
}

function setupSwipeGestures() {
    let startX = null;
    let startY = null;

    document.addEventListener('touchstart', function(e) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    });

    document.addEventListener('touchmove', function(e) {
        if (!startX || !startY) return;

        let diffX = startX - e.touches[0].clientX;
        let diffY = startY - e.touches[0].clientY;

        if (Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX > 50 && isSidebarOpen) {
                // Swipe left to close sidebar
                closeSidebar();
            } else if (diffX < -50 && !isSidebarOpen) {
                // Swipe right to open sidebar
                toggleSidebar();
            }
        }

        startX = null;
        startY = null;
    });
}

// Mobile sidebar functions
function toggleSidebar() {
    const sidebar = document.getElementById('mobileSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (isSidebarOpen) {
        closeSidebar();
    } else {
        sidebar.classList.add('active');
        overlay.classList.add('active');
        isSidebarOpen = true;
        
        // Prevent body scroll when sidebar is open
        document.body.style.overflow = 'hidden';
    }
}

function closeSidebar() {
    const sidebar = document.getElementById('mobileSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
    isSidebarOpen = false;
    
    // Restore body scroll
    document.body.style.overflow = '';
}

// Show/Hide screens
function showLoadingScreen() {
    document.getElementById('loadingScreen').style.display = 'flex';
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'none';
}

function hideLoadingScreen() {
    document.getElementById('loadingScreen').style.display = 'none';
}

function showAuthScreen() {
    document.getElementById('authScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
}

function showMainApp() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'flex';
}

// Authentication Functions
function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    document.getElementById(`${tab}Form`).classList.add('active');
}

async function login() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        showErrorMessage('Please fill in all fields');
        return;
    }
    
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
    
    if (!name || !email || !password || !username) {
        showErrorMessage('Please fill in all fields');
        return;
    }
    
    if (password.length < 6) {
        showErrorMessage('Password must be at least 6 characters');
        return;
    }
    
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        await user.updateProfile({
            displayName: name
        });
        
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
    if (confirm('Are you sure you want to logout?')) {
        auth.signOut();
    }
}

// User Data Functions
async function loadUserData() {
    if (!currentUser) return;
    
    try {
        const userSnapshot = await database.ref(`users/${currentUser.uid}`).once('value');
        const userData = userSnapshot.val();
        
        if (userData) {
            document.getElementById('userName').textContent = userData.name;
            document.getElementById('userAvatar').src = userData.avatar;
            document.getElementById('userStatus').textContent = userData.status || 'Online';
            
            const badge = document.getElementById('verificationBadge');
            if (userData.isVerified) {
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
            
            await database.ref(`users/${currentUser.uid}/lastSeen`).set(Date.now());
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

async function checkAdminStatus() {
    if (!currentUser) return;
    
    try {
        const adminSnapshot = await database.ref(`admins/${currentUser.uid}`).once('value');
        isAdmin = adminSnapshot.exists();
        
        // Make first user admin automatically
        if (!isAdmin) {
            const usersSnapshot = await database.ref('users').once('value');
            const users = usersSnapshot.val() || {};
            if (Object.keys(users).length === 1) {
                await database.ref(`admins/${currentUser.uid}`).set(true);
                isAdmin = true;
            }
        }
    } catch (error) {
        console.error('Error checking admin status:', error);
    }
}

// Chat Functions
async function loadChats() {
    const chatList = document.getElementById('chatList');
    if (!chatList) return;
    
    chatList.innerHTML = '';
    
    try {
        const userChatsRef = database.ref(`userChats/${currentUser.uid}`);
        userChatsRef.on('value', async (snapshot) => {
            const userChats = snapshot.val() || {};
            chatList.innerHTML = ''; // Clear existing chats
            
            for (const chatId in userChats) {
                try {
                    const chatSnapshot = await database.ref(`chats/${chatId}`).once('value');
                    const chatData = chatSnapshot.val();
                    
                    if (chatData) {
                        const chatElement = createChatElement(chatId, chatData);
                        chatList.appendChild(chatElement);
                    }
                } catch (error) {
                    console.error('Error loading chat:', error);
                }
            }
        });
        
        await createDefaultChannels();
    } catch (error) {
        console.error('Error loading chats:', error);
    }
}

function createChatElement(chatId, chatData) {
    const div = document.createElement('div');
    div.className = 'chat-item';
    div.dataset.chatType = chatData.type || 'group';
    div.onclick = () => openChat(chatId, chatData);
    
    const lastMessage = chatData.lastMessage || 'No messages yet';
    const memberCount = chatData.members ? Object.keys(chatData.members).length : 0;
    
    div.innerHTML = `
        <img src="${chatData.avatar || 'https://via.placeholder.com/55'}" alt="Chat" class="chat-avatar">
        <div class="chat-info">
            <div class="chat-name">
                ${chatData.name}
                ${chatData.type === 'channel' ? '<i class="fas fa-bullhorn" style="color: #1da1f2;"></i>' : ''}
                ${chatData.isVerified ? '<i class="fas fa-check-circle" style="color: #1da1f2;"></i>' : ''}
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
    
    // Close sidebar on mobile
    closeSidebar();
    
    // Update active chat
    document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    // Update chat header
    document.getElementById('chatName').textContent = chatData.name;
    document.getElementById('chatAvatar').src = chatData.avatar || 'https://via.placeholder.com/45';
    document.getElementById('chatStatus').textContent = `${Object.keys(chatData.members || {}).length} members`;
    
    // Show chat header and input
    document.getElementById('chatHeader').style.display = 'flex';
    document.getElementById('messageInputArea').style.display = 'block';
    
    // Load messages
    loadMessages(chatId);
    
    // Hide welcome message
    const welcomeMsg = document.querySelector('.welcome-message');
    if (welcomeMsg) welcomeMsg.style.display = 'none';
}

function loadMessages(chatId) {
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) return;
    
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
            <img src="${message.senderAvatar || 'https://via.placeholder.com/30'}" alt="Avatar" class="message-avatar">
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
    
    try {
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
        
        await database.ref(`messages/${currentChat}`).push(message);
        await database.ref(`chats/${currentChat}`).update({
            lastMessage: messageText,
            lastMessageTime: Date.now()
        });
        
        document.getElementById('messageText').value = '';
        
        // Reset textarea height
        const textarea = document.getElementById('messageText');
        textarea.style.height = 'auto';
        
    } catch (error) {
        showErrorMessage('Failed to send message: ' + error.message);
    }
}

function handleEnterKey(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

// Media Functions
function toggleAttachments() {
    const options = document.getElementById('attachmentOptions');
    if (options) {
        options.style.display = options.style.display === 'flex' ? 'none' : 'flex';
    }
}

function attachPhoto() {
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.accept = 'image/*';
        fileInput.click();
    }
}

function attachVideo() {
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.accept = 'video/*';
        fileInput.click();
    }
}

function attachFile() {
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.accept = '*/*';
        fileInput.click();
    }
}

async function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!currentChat) {
        showErrorMessage('Please select a chat first');
        return;
    }
    
    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        showErrorMessage('File size must be less than 10MB');
        return;
    }
    
    try {
        showSuccessMessage('Uploading file...');
        
        const uploadUrl = await uploadToDataURL(file);
        
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
    
    event.target.value = '';
    toggleAttachments();
}

async function uploadToDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

// Group/Channel Functions
function createGroup() {
    showSuccessMessage('Create Group feature - Coming soon!');
}

async function createDefaultChannels() {
    const defaultChannels = [
        { name: 'General Chat', description: 'General discussion channel' },
        { name: 'Tech News', description: 'Latest technology news and updates' },
        { name: 'Gaming Zone', description: 'Gaming discussions and tips' },
        { name: 'Music Lovers', description: 'Share and discuss music' }
    ];
    
    for (const channel of defaultChannels) {
        const chatId = `default_${channel.name.toLowerCase().replace(' ', '_')}`;
        
        try {
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
            
            // Add some bots to channels
            await addBotsToChat(chatId, Math.floor(Math.random() * 300) + 100);
        } catch (error) {
            console.error('Error creating default channel:', error);
        }
    }
}

// Admin Panel Functions
function showAdminPanel() {
    if (!isAdmin) {
        showErrorMessage('Access denied. Admin privileges required.');
        return;
    }
    
    showSuccessMessage('Admin Panel - Coming soon!');
}

async function generateBots() {
    if (!isAdmin) {
        showErrorMessage('Admin privileges required');
        return;
    }
    
    const count = 50; // Generate 50 bots
    
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
                isVerified: Math.random() > 0.8,
                followers: Math.floor(Math.random() * 10000),
                following: Math.floor(Math.random() * 1000),
                joinedAt: Date.now() - Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000),
                lastSeen: Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000),
                status: Math.random() > 0.3 ? 'online' : 'offline'
            };
            
            await database.ref(`users/bot_${Date.now()}_${i}`).set(botData);
        }
        
        showSuccessMessage(`${count} bots generated successfully!`);
    } catch (error) {
        showErrorMessage('Failed to generate bots: ' + error.message);
    }
}

async function addBotsToChat(chatId, count = 50) {
    try {
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
        
        if (Object.keys(updates).length > 0) {
            await database.ref().update(updates);
        }
    } catch (error) {
        console.error('Error adding bots to chat:', error);
    }
}

// Chat List Filtering
function showChatList(filter) {
    document.querySelectorAll('.chat-tab').forEach(tab => tab.classList.remove('active'));
    event.target.classList.add('active');
    
    const chatItems = document.querySelectorAll('.chat-item');
    chatItems.forEach(item => {
        const chatType = item.dataset.chatType || 'group';
        
        switch (filter) {
            case 'all':
                item.style.display = 'flex';
                break;
            case 'people':
                item.style.display = chatType === 'personal' ? 'flex' : 'none';
                break;
            case 'groups':
                item.style.display = chatType === 'group' ? 'flex' : 'none';
                break;
            case 'channels':
                item.style.display = chatType === 'channel' ? 'flex' : 'none';
                break;
        }
    });
}

// Search Functions
function searchChats(query) {
    const chatItems = document.querySelectorAll('.chat-item');
    chatItems.forEach(item => {
        const chatName = item.querySelector('.chat-name').textContent.toLowerCase();
        item.style.display = chatName.includes(query.toLowerCase()) ? 'flex' : 'none';
    });
}

// Utility Functions
function showSuccessMessage(message) {
    const toast = document.createElement('div');
    toast.className = 'toast success';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

function showErrorMessage(message) {
    const toast = document.createElement('div');
    toast.className = 'toast error';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h';
    return Math.floor(diff / 86400000) + 'd';
}

// Placeholder functions for future features
function showFriends() {
    showSuccessMessage('Friends feature - Coming soon!');
}

function showDiscovery() {
    showSuccessMessage('Discovery feature - Coming soon!');
}

function showSearch() {
    showSuccessMessage('Search feature - Coming soon!');
}

function showSettings() {
    showSuccessMessage('Settings feature - Coming soon!');
}

function showMembers() {
    showSuccessMessage('Members feature - Coming soon!');
}

function addBots() {
    if (!currentChat) {
        showErrorMessage('Please select a chat first');
        return;
    }
    
    if (!isAdmin) {
        showErrorMessage('Admin privileges required');
        return;
    }
    
    addBotsToChat(currentChat, 100);
    showSuccessMessage('100 bots added to the chat!');
}