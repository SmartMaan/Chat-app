// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAL5e-5eQfgf1nI6hWTnhwLFgK0Cp89aa0",
  authDomain: "aviator-pr01.firebaseapp.com",
  databaseURL: "https://aviator-pr01-default-rtdb.firebaseio.com",
  projectId: "aviator-pr01",
  storageBucket: "aviator-pr01.firebasestorage.app",
  messagingSenderId: "290788041297",
  appId: "1:290788041297:web:168f99d1532997fb778e70",
  measurementId: "G-ENCBTT4BL8"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = firebase.auth();
const database = firebase.database();
const firestore = firebase.firestore();

// Global variables
let currentUser = null;
let currentChat = null;
let isAdmin = false;

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

// Media upload API endpoints (free services)
const mediaUploadAPIs = {
    image: 'https://api.imgbb.com/1/upload',
    video: 'https://api.streamable.com/upload'
};

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', function() {
    showLoadingScreen();
    
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