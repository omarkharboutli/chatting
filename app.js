const firebaseConfig = {
    apiKey: "AIzaSyD7CF-vhlip_kEWX8yLwedxnPmvvhPFEWA",
    authDomain: "group-chat-app-28514.firebaseapp.com",
    databaseURL: "https://group-chat-app-28514-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "group-chat-app-28514",
    storageBucket: "group-chat-app-28514.appspot.com",
    messagingSenderId: "952526179804",
    appId: "1:952526179804:web:8a2e74927e8084f9d35319"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

// DOM Elements
const authContainer = document.getElementById('auth-container');
const chatContainer = document.getElementById('chat-container');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userDisplayName = document.getElementById('user-display-name');
const fileInput = document.getElementById('file-input');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const messagesDiv = document.getElementById('messages');
const voiceMsgBtn = document.getElementById('voice-msg-btn');
const voiceMsgIndicator = document.getElementById('voice-msg-indicator');
const recordingTime = document.getElementById('recording-time');
const cancelVoiceBtn = document.getElementById('cancel-voice-btn');
const voiceIndicatorContainer = document.querySelector('.voice-indicator-container');
const confirmationDialog = document.getElementById('confirmation-dialog');
const confirmUnsendBtn = document.getElementById('confirm-unsend');
const cancelUnsendBtn = document.getElementById('cancel-unsend');

// Audio Configuration
const AUDIO_FORMATS = [
    { mime: 'audio/webm;codecs=opus', ext: 'webm' },
    { mime: 'audio/mp4', ext: 'mp4' },
    { mime: 'audio/ogg;codecs=opus', ext: 'ogg' }
];
let supportedAudioFormat = AUDIO_FORMATS.find(f => MediaRecorder.isTypeSupported(f.mime)) || 
                         { mime: '', ext: 'webm' };

// Voice Message Variables
let voiceRecorder;
let audioChunks = [];
let recordingStartTime;
let recordingInterval;
let isRecording = false;
let currentMessageIdToDelete = null;
const maxRecordingTime = 120; // 2 minutes max

// Store usernames
const usernameMap = {
    "nedalomarsahar@gmail.com": "sahar",
    "omarkharbutli9@gmail.com": "omar",
    "nedalkharboutli@gmail.com": "nedal",
};

// Store attachments to be sent
let attachments = [];

// Check if device is mobile
const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);

// Auth State Listener
auth.onAuthStateChanged(user => {
    if (user) {
        const displayName = usernameMap[user.email] || user.email.split('@')[0];
        showChatInterface(displayName);
        setupChat(user.email);
    } else {
        showLoginInterface();
    }
});

function showChatInterface(displayName) {
    authContainer.classList.add('hidden');
    chatContainer.classList.remove('hidden');
    userDisplayName.textContent = displayName;
}

function showLoginInterface() {
    authContainer.classList.remove('hidden');
    chatContainer.classList.add('hidden');
    emailInput.value = '';
    passwordInput.value = '';
}

// Login Handler
loginBtn.addEventListener('click', async () => {
    const email = emailInput.value;
    const password = passwordInput.value;

    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        alert(`Login failed: ${error.message}`);
    }
});

// Logout Handler
logoutBtn.addEventListener('click', () => {
    auth.signOut();
    attachments = [];
});

// Voice Message Event Listeners
voiceMsgBtn.addEventListener('click', toggleVoiceRecording);
cancelVoiceBtn.addEventListener('click', cancelVoiceRecording);

function toggleVoiceRecording() {
    if (isRecording) {
        stopVoiceRecording(new Event('click'));
    } else {
        startVoiceRecording(new Event('click'));
    }
}

function startVoiceRecording(e) {
    e.preventDefault();
    if (isRecording) return;
    
    isRecording = true;
    voiceMsgBtn.classList.add('recording');
    voiceIndicatorContainer.style.display = 'flex';
    
    // Create and display timer
    const timer = document.createElement('div');
    timer.className = 'recording-timer';
    timer.id = 'recording-timer';
    voiceMsgBtn.parentNode.insertBefore(timer, voiceMsgBtn);
    
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            voiceRecorder = new MediaRecorder(stream, { 
                mimeType: supportedAudioFormat.mime 
            });
            audioChunks = [];
            
            voiceRecorder.ondataavailable = e => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };
            
            voiceRecorder.onstop = () => {
                clearInterval(recordingInterval);
                const timerElement = document.getElementById('recording-timer');
                if (timerElement) timerElement.remove();
            };
            
            voiceRecorder.start(200); // Collect data every 200ms
            recordingStartTime = Date.now();
            updateRecordingTime();
            recordingInterval = setInterval(updateRecordingTime, 1000);
            
            setTimeout(() => {
                if (isRecording) {
                    stopVoiceRecording(new Event('timeout'));
                }
            }, maxRecordingTime * 1000);
            
            voiceMsgIndicator.classList.remove('hidden');
            sendBtn.classList.add('hidden');
        })
        .catch(err => {
            console.error("Error accessing microphone:", err);
            alert("Microphone access denied. Please allow microphone access to send voice messages.");
            cancelVoiceRecording();
        });
}

function stopVoiceRecording(e) {
    if (!isRecording) return;
    e.preventDefault();
    
    clearInterval(recordingInterval);
    const timerElement = document.getElementById('recording-timer');
    if (timerElement) timerElement.remove();
    
    if (voiceRecorder && voiceRecorder.state === 'recording') {
        voiceRecorder.stop();
        voiceRecorder.stream.getTracks().forEach(track => track.stop());
    }
    
    resetVoiceUI();
    
    const audioBlob = new Blob(audioChunks, { type: supportedAudioFormat.mime });
    sendVoiceMessage(audioBlob);
}

function cancelVoiceRecording() {
    if (!isRecording) return;
    
    clearInterval(recordingInterval);
    const timerElement = document.getElementById('recording-timer');
    if (timerElement) timerElement.remove();
    
    if (voiceRecorder && voiceRecorder.state === 'recording') {
        voiceRecorder.stop();
        voiceRecorder.stream.getTracks().forEach(track => track.stop());
    }
    
    resetVoiceUI();
}

function resetVoiceUI() {
    isRecording = false;
    voiceMsgBtn.classList.remove('recording');
    voiceIndicatorContainer.style.display = 'none';
    voiceMsgIndicator.classList.add('hidden');
    updateButtonVisibility();
}

function updateRecordingTime() {
    const seconds = Math.floor((Date.now() - recordingStartTime) / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    recordingTime.textContent = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    
    const timerElement = document.getElementById('recording-timer');
    if (timerElement) {
        timerElement.textContent = recordingTime.textContent;
    }
}

function sendVoiceMessage(audioBlob) {
    const reader = new FileReader();
    reader.onload = () => {
        const base64Audio = reader.result.split(',')[1];
        const duration = Math.floor((Date.now() - recordingStartTime) / 1000);
        
        const messagesRef = database.ref('messages');
        messagesRef.push({
            type: 'voice',
            audio: base64Audio,
            format: supportedAudioFormat.ext,
            duration: duration,
            email: auth.currentUser.email,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
    };
    reader.readAsDataURL(audioBlob);
}

// File Attachment Handler
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 1 * 1024 * 1024) {
        alert('File too large (max 1MB)');
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        const previewContainer = document.createElement('div');
        previewContainer.className = 'attachment-preview';
        
        if (file.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = event.target.result;
            previewContainer.appendChild(img);
        }
        
        const info = document.createElement('div');
        info.className = 'attachment-info';
        info.innerHTML = `
            <div class="attachment-name">${file.name}</div>
            <div>${(file.size / 1024).toFixed(2)} KB</div>
            <span class="remove-attachment">✕</span>
        `;
        
        previewContainer.appendChild(info);
        messagesDiv.appendChild(previewContainer);
        
        attachments = [{
            name: file.name,
            type: file.type,
            size: file.size,
            data: event.target.result.split(',')[1]
        }];
        
        info.querySelector('.remove-attachment').onclick = () => {
            previewContainer.remove();
            attachments = [];
            updateButtonVisibility();
        };
        updateButtonVisibility();
    };
    reader.readAsDataURL(file);
});

// Chat Functionality
function setupChat(currentUserEmail) {
    const messagesRef = database.ref('messages');
    const messageElements = {};

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    messagesRef.on('child_added', snapshot => {
        const message = snapshot.val();
        const isCurrentUser = message.email === currentUserEmail;
        const displayName = usernameMap[message.email] || message.email.split('@')[0];
        
        const messageEl = document.createElement('div');
        messageEl.className = `message ${isCurrentUser ? 'my-message' : 'their-message'}`;
        messageEl.setAttribute('data-id', snapshot.key);
        
        let content = `<div class="message-info">${displayName} • ${formatTime(message.timestamp)}</div>`;
        
        if (message.type === 'voice') {
            const audioSrc = `data:audio/${message.format || 'webm'};base64,${message.audio}`;
            content += `
                <div class="voice-message-container">
                    <audio controls onerror="handleAudioError(this)" src="${audioSrc}"></audio>
                    <span class="voice-duration">${message.duration}s</span>
                </div>
                <div class="audio-fallback" style="display: none;">
                    <a href="${audioSrc}" download="voice_message.${message.format || 'webm'}">Download voice message</a>
                </div>
            `;
        } else if (message.text) {
            content += `<div class="text">${message.text}</div>`;
        }
        
        if (isCurrentUser) {
            content += `
                <div class="message-actions">
                    <button class="unsend-btn" data-id="${snapshot.key}">×</button>
                </div>
            `;
        }
        
        messageEl.innerHTML = content;
        messagesDiv.appendChild(messageEl);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        messageElements[snapshot.key] = messageEl;

        // Check if audio can play after a short delay
        const audioElement = messageEl.querySelector('audio');
        if (audioElement) {
            setTimeout(() => {
                audioElement.play().catch(e => {
                    console.log("Audio playback failed, showing fallback");
                    const fallback = messageEl.querySelector('.audio-fallback');
                    if (fallback) fallback.style.display = 'block';
                });
            }, 500);
        }
    });

    messagesRef.on('child_removed', snapshot => {
        const messageId = snapshot.key;
        const messageEl = messageElements[messageId];
        if (messageEl) {
            messageEl.remove();
            delete messageElements[messageId];
        }
    });

    // Custom unsend confirmation dialog
    messagesDiv.addEventListener('click', (e) => {
        if (e.target.classList.contains('unsend-btn')) {
            currentMessageIdToDelete = e.target.getAttribute('data-id');
            confirmationDialog.classList.add('active');
        }
    });

    confirmUnsendBtn.addEventListener('click', () => {
        if (currentMessageIdToDelete) {
            messagesRef.child(currentMessageIdToDelete).remove()
                .catch(error => console.error('Failed to unsend message:', error));
        }
        confirmationDialog.classList.remove('active');
        currentMessageIdToDelete = null;
    });

    cancelUnsendBtn.addEventListener('click', () => {
        confirmationDialog.classList.remove('active');
        currentMessageIdToDelete = null;
    });

    sendBtn.addEventListener('click', async () => {
        const text = messageInput.value.trim();
        if (!text && attachments.length === 0) return;

        try {
            await messagesRef.push({
                text,
                email: currentUserEmail,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                ...(attachments.length > 0 && { 
                    attachment: attachments[0] 
                })
            });

            // Reset inputs
            messageInput.value = '';
            attachments = [];
            
            // Force UI update for PC
            if (!isMobile) {
                messageInput.dispatchEvent(new Event('input'));
            }
        } catch (error) {
            alert('Failed to send message');
            console.error(error);
        }
    });

    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendBtn.click();
        }
    });

    messageInput.addEventListener('input', updateButtonVisibility);
}

function updateButtonVisibility() {
    if (messageInput.value.trim() === '' && attachments.length === 0) {
        sendBtn.classList.add('hidden');
        voiceMsgBtn.classList.remove('hidden');
    } else {
        sendBtn.classList.remove('hidden');
        voiceMsgBtn.classList.add('hidden');
    }
}

// Audio error handler
window.handleAudioError = function(audioElement) {
    console.log("Audio playback failed, showing fallback");
    const fallback = audioElement.parentElement.querySelector('.audio-fallback');
    if (fallback) fallback.style.display = 'block';
};

// Initialize button visibility on load
window.addEventListener('DOMContentLoaded', () => {
    updateButtonVisibility();
});
