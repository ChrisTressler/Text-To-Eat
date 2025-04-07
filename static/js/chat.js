const chatMessages = document.getElementById('chat-messages');
const llmInput = document.getElementById('llm-input');
const llmSubmit = document.getElementById('llm-submit');

function addMessage(text, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user' : 'system'}`;
    
    const messagePara = document.createElement('p');
    messagePara.textContent = text;
    
    messageDiv.appendChild(messagePara);
    chatMessages.appendChild(messageDiv);
    
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.id = 'typing-indicator';
    
    for (let i = 0; i < 3; i++) {
        const dot = document.createElement('span');
        indicator.appendChild(dot);
    }
    
    chatMessages.appendChild(indicator);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function setupSpeechToText() {
    const micButton = document.createElement('button');
    micButton.id = 'mic-button';
    micButton.className = 'mic-button';
    micButton.innerHTML = '<i class="fas fa-microphone"></i>';
    micButton.title = 'Click to speak';
    
    const chatInputContainer = document.querySelector('.chat-input-container');
    if (chatInputContainer) {
        const inputWrapper = document.createElement('div');
        inputWrapper.className = 'input-mic-wrapper';
      
        const textarea = document.getElementById('llm-input');
      
        if (textarea) {
            chatInputContainer.removeChild(textarea);
            inputWrapper.appendChild(textarea);
            inputWrapper.appendChild(micButton);
        
            chatInputContainer.insertBefore(inputWrapper, chatInputContainer.firstChild);
        }
    }
    
    let recognition = null;
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
    } catch (e) {
      console.error('Speech recognition not supported:', e);
      micButton.disabled = true;
      micButton.title = 'Speech recognition not supported in this browser';
    }
    
    if (recognition) {
        let isListening = false;
      
        micButton.addEventListener('click', () => {
            const textarea = document.getElementById('llm-input');
            
            if (isListening) {
            recognition.stop();
            micButton.classList.remove('listening');
            micButton.innerHTML = '<i class="fas fa-microphone"></i>';
            } else {
            recognition.start();
            micButton.classList.add('listening');
            micButton.innerHTML = '<i class="fas fa-microphone-slash"></i>';
            }
            
            isListening = !isListening;
        });
      
        recognition.onresult = (event) => {
                const textarea = document.getElementById('llm-input');
                const resultIndex = event.resultIndex;
                const transcript = event.results[resultIndex][0].transcript;
                
                textarea.value = transcript;
        };
      
        recognition.onend = () => {
                isListening = false;
                micButton.classList.remove('listening');
                micButton.innerHTML = '<i class="fas fa-microphone"></i>';
        };
      
        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            isListening = false;
            micButton.classList.remove('listening');
            micButton.innerHTML = '<i class="fas fa-microphone"></i>';
            
            if (window.showNotification) {
            window.showNotification('Speech recognition error: ' + event.error, 'error');
            }
        };
    }
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

async function sendMessage(message) {
    addMessage(message, true);
    showTypingIndicator();
    
    try {
        let cartItems = {};
        let orderTotal = 0;
        
        try {
            const cartResponse = await fetch('/api/get_cart', { 
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                cache: 'no-store'
            });
            const cartData = await cartResponse.json();
            
            if (cartData.success) {
                cartItems = cartData.cart;
                orderTotal = cartData.total;
            }
        } catch (e) {
            console.error('Error fetching cart from session:', e);
            cartItems = JSON.parse(localStorage.getItem('cartItems') || '{}');
            orderTotal = parseFloat(localStorage.getItem('cartTotal') || '0');
        }
        
        let orderItems = [];
        
        for (const [itemId, item] of Object.entries(cartItems)) {
            orderItems.push({
                id: item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity
            });
        }
        
        const currentOrder = {
            menuItems: orderItems,
            total: orderTotal
        };

        const conversationHistory = [];
        const messageElements = document.querySelectorAll('#chat-messages .message');
        
        messageElements.forEach(element => {
            const isBot = element.classList.contains('system');
            const messageText = element.querySelector('p').textContent;
            
            conversationHistory.push({
                message: messageText,
                isBot: isBot
            });
        });
        
        const isRemovalIntent = /remove|delete|take off|clear|empty/i.test(message);
        
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                currentOrder: currentOrder,
                conversationHistory: conversationHistory
            }),
        });
        
        const data = await response.json();
        
        removeTypingIndicator();
        addMessage(data.response);
        
        if (isRemovalIntent || (data.removed_items && data.removed_items.length > 0)) {
            if (typeof window.forceCartRefresh === 'function') {
                window.forceCartRefresh();
            }
            
            [100, 300, 600].forEach(delay => {
                setTimeout(() => {
                    if (typeof window.forceCartRefresh === 'function') {
                        window.forceCartRefresh();
                    }
                    
                    if (typeof window.updateCartDisplay === 'function') {
                        window.updateCartDisplay();
                    }
                    
                    const event = new CustomEvent('cartUpdated', { 
                        detail: { source: 'llmRemoval' } 
                    });
                    window.dispatchEvent(event);
                }, delay);
            });
            
            setTimeout(async () => {
                try {
                    const refreshResponse = await fetch('/api/get_cart', {
                        method: 'GET',
                        headers: { 'Content-Type': 'application/json' },
                        cache: 'no-store'
                    });
                    
                    if (refreshResponse.ok) {
                        const refreshData = await refreshResponse.json();
                        if (refreshData.success) {
                            localStorage.setItem('cartItems', JSON.stringify(refreshData.cart));
                            localStorage.setItem('cartTotal', refreshData.total.toString());
                            
                            if (typeof window.updateCartCountBadge === 'function') {
                                window.updateCartCountBadge();
                            }
                            
                            if (typeof window.updateCartDisplay === 'function') {
                                window.updateCartDisplay();
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error fetching updated cart data:', e);
                }
            }, 200);
        } else {
            if (typeof window.forceCartRefresh === 'function') {
                window.forceCartRefresh();
                
                setTimeout(() => {
                    if (typeof window.forceCartRefresh === 'function') {
                        window.forceCartRefresh();
                    }
                }, 300);
            }
        }
        
        if (data.items && data.items.length > 0) {
            const addedItems = data.items.map(item => item.name || 'Item').join(', ');
            const notification = `Added to cart: ${addedItems}`;
            if (window.showNotification) {
                window.showNotification(notification);
            }
        }
        
        if (data.removed_items && data.removed_items.length > 0) {
            const removedItems = data.removed_items.join(', ');
            const notification = `Removed from cart: ${removedItems}`;
            if (window.showNotification) {
                window.showNotification(notification);
            }
        }
        
        if (data.action === 'checkout') {
            window.location.href = '/checkout';
        }
        
        localStorage.setItem('currentOrder', JSON.stringify(data.order));
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
    } catch (error) {
        console.error('Error:', error);
        removeTypingIndicator();
        addMessage('Sorry, I encountered an error. Please try again.');
    }
}

function setupChatInterface() {
    if (llmSubmit && llmInput) {
        llmSubmit.addEventListener('click', function() {
            const message = llmInput.value.trim();
            if (message) {
                sendMessage(message);
                llmInput.value = '';
            }
        });
    }
    
    if (llmInput) {
        llmInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const message = llmInput.value.trim();
                if (message) {
                    sendMessage(message);
                    llmInput.value = '';
                }
            }
        });
    }
}

function initializeChat() {
    setupChatInterface();
    
    setTimeout(() => {
        if (chatMessages && chatMessages.children.length === 0) {
            addMessage("Welcome to McDonald's! How can I help you today? You can order items, customize them, or ask about our menu.");
        }
    }, 300);
}

document.addEventListener('DOMContentLoaded', initializeChat);

window.addEventListener('storage', function(e) {
    if (e.key === 'cartItems' || e.key === 'cartTotal') {
        if (typeof window.updateGlobalCartState === 'function') {
            window.updateGlobalCartState();
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(setupSpeechToText, 500);
});
