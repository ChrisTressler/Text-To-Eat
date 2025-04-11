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

function setupAutoResizingTextarea() {
    const textarea = document.getElementById('llm-input');
    if (!textarea) return;
    
    // Set initial height
    textarea.style.height = 'auto';
    textarea.style.height = (textarea.scrollHeight) + 'px';
    
    // Set minimum and maximum heights
    textarea.style.minHeight = '50px';
    textarea.style.maxHeight = '200px';
    
    // Function to resize the textarea
    const resizeTextarea = () => {
        // Store the scroll position
        const scrollPos = window.pageYOffset || document.documentElement.scrollTop;
        
        // Temporarily shrink the textarea to get the right scrollHeight
        textarea.style.height = 'auto';
        
        // Calculate new height (with a small buffer to prevent text from touching the mic icon)
        const newHeight = Math.min(200, textarea.scrollHeight);
        textarea.style.height = newHeight + 'px';
        
        // Restore the scroll position to prevent page jumping
        window.scrollTo(0, scrollPos);
        
        // If we have a mic button, ensure it's properly positioned
        const micButton = document.getElementById('mic-button');
        if (micButton) {
            // Position the mic button vertically centered
            const textareaRect = textarea.getBoundingClientRect();
            const micButtonRect = micButton.getBoundingClientRect();
            const topOffset = (textareaRect.height - micButtonRect.height) / 2;
            micButton.style.top = `${topOffset}px`;
        }
    };
    
    // Add event listeners for input and focus
    textarea.addEventListener('input', resizeTextarea);
    textarea.addEventListener('focus', resizeTextarea);
    
    // Also resize when window is resized
    window.addEventListener('resize', resizeTextarea);
    
    // Initial resize
    resizeTextarea();
}

function setupSpeechToText() {
    // Check if we've already set up the mic button to avoid duplicates
    if (document.getElementById('mic-button')) {
        return;
    }
    
    const micButton = document.createElement('button');
    micButton.id = 'mic-button';
    micButton.className = 'mic-button';
    micButton.innerHTML = '<i class="fas fa-microphone"></i>';
    micButton.title = 'Click to speak';
    
    const chatInputContainer = document.querySelector('.chat-input-container');
    if (chatInputContainer) {
        const inputWrapper = document.createElement('div');
        inputWrapper.className = 'input-mic-wrapper';
        inputWrapper.style.position = 'relative'; // Ensure relative positioning
      
        const textarea = document.getElementById('llm-input');
      
        if (textarea) {
            chatInputContainer.removeChild(textarea);
            
            // Add some right padding to the textarea to make room for the mic button
            textarea.style.paddingRight = '40px';
            
            inputWrapper.appendChild(textarea);
            inputWrapper.appendChild(micButton);
            
            // Position the mic button absolutely within the wrapper
            micButton.style.position = 'absolute';
            micButton.style.right = '10px';
            micButton.style.top = '50%';
            micButton.style.transform = 'translateY(-50%)';
        
            chatInputContainer.insertBefore(inputWrapper, chatInputContainer.firstChild);
            
            // Initial resize of the textarea
            if (typeof setupAutoResizingTextarea === 'function') {
                setupAutoResizingTextarea();
            }
        }
    }
    
    let recognition = null;
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      if (SpeechRecognition.maxAlternatives) {
        recognition.maxAlternatives = 1;
      }
    } catch (e) {
      console.error('Speech recognition not supported:', e);
      micButton.disabled = true;
      micButton.title = 'Speech recognition not supported in this browser';
    }
    
    if (recognition) {
        let isListening = false;
        let finalTranscript = '';
        let silenceTimer = null;
        const silenceTimeout = 4000;
      
        micButton.addEventListener('click', () => {
            const textarea = document.getElementById('llm-input');
            
            if (isListening) {
                clearTimeout(silenceTimer);
                recognition.stop();
                micButton.classList.remove('listening');
                micButton.innerHTML = '<i class="fas fa-microphone"></i>';
            } else {
                finalTranscript = '';
                recognition.start();
                micButton.classList.add('listening');
                micButton.innerHTML = '<i class="fas fa-microphone-slash"></i>';
            }
            
            isListening = !isListening;
        });
      
        recognition.onresult = (event) => {
            const textarea = document.getElementById('llm-input');
            let interimTranscript = '';
            
            if (silenceTimer) {
                clearTimeout(silenceTimer);
            }
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript += transcript;
                }
            }
            
            textarea.value = finalTranscript + interimTranscript;
            
            // Manually trigger resize after updating the text value
            // This is the key addition to make the textarea resize during speech
            if (textarea.style.height) {
                textarea.style.height = 'auto';
                textarea.style.height = Math.min(200, textarea.scrollHeight) + 'px';
                
                // Also update mic button position if needed
                const micButton = document.getElementById('mic-button');
                if (micButton) {
                    const textareaRect = textarea.getBoundingClientRect();
                    const micButtonRect = micButton.getBoundingClientRect();
                    const topOffset = (textareaRect.height - micButtonRect.height) / 2;
                    micButton.style.top = `${topOffset}px`;
                }
            }
            
            silenceTimer = setTimeout(() => {
                if (isListening) {
                    if (finalTranscript.trim() !== '') {
                        recognition.stop();
                    }
                }
            }, silenceTimeout);
        };
      
        recognition.onend = () => {
            isListening = false;
            micButton.classList.remove('listening');
            micButton.innerHTML = '<i class="fas fa-microphone"></i>';
            
            if (silenceTimer) {
                clearTimeout(silenceTimer);
                silenceTimer = null;
            }
        };
      
        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            isListening = false;
            micButton.classList.remove('listening');
            micButton.innerHTML = '<i class="fas fa-microphone"></i>';
            
            if (silenceTimer) {
                clearTimeout(silenceTimer);
                silenceTimer = null;
            }
            
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
        // Remove any existing event listeners by cloning and replacing the element
        const oldSubmitBtn = llmSubmit;
        const newSubmitBtn = oldSubmitBtn.cloneNode(true);
        oldSubmitBtn.parentNode.replaceChild(newSubmitBtn, oldSubmitBtn);
        
        // Add the event listener to the new button
        newSubmitBtn.addEventListener('click', function() {
            const message = llmInput.value.trim();
            if (message) {
                sendMessage(message);
                llmInput.value = '';
                // Reset height after clearing
                llmInput.style.height = '50px';
            }
        });
        
        // Update the global reference
        window.llmSubmit = newSubmitBtn;
        // Also update the local reference for this function to work
        llmSubmit = newSubmitBtn;
    }
    
    if (llmInput) {
        // Remove any existing event listeners by cloning and replacing the element
        const oldInput = llmInput;
        const newInput = oldInput.cloneNode(true);
        oldInput.parentNode.replaceChild(newInput, oldInput);
        
        // Add the event listener to the new input
        newInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                // Use the local reference instead of getElementById
                llmSubmit.click();
            }
        });
        
        // Update the global reference
        window.llmInput = newInput;
        // Also update the local reference for this function to work
        llmInput = newInput;
    }
    
    // Initialize auto-resizing
    setupAutoResizingTextarea();
}

// Track if we've already initialized the chat
let chatInitialized = false;

function initializeChat() {
    // Only initialize once
    if (chatInitialized) {
        console.log('Chat already initialized, skipping duplicate initialization');
        return;
    }
    
    // Refresh our references to the DOM elements
    const chatMessagesElement = document.getElementById('chat-messages');
    const llmInputElement = document.getElementById('llm-input');
    const llmSubmitElement = document.getElementById('llm-submit');
    
    // Update our global references
    if (chatMessagesElement) chatMessages = chatMessagesElement;
    if (llmInputElement) llmInput = llmInputElement;
    if (llmSubmitElement) llmSubmit = llmSubmitElement;
    
    setupChatInterface();
    
    setTimeout(() => {
        if (chatMessages && chatMessages.children.length === 0) {
            addMessage("Welcome to McDonald's! How can I help you today? You can order items, customize them, or ask about our menu.");
        }
    }, 300);
    
    chatInitialized = true;
}

// Use a self-executing function to ensure we only set up event listeners once
(function() {
    // Check if we've already set up the event listeners
    if (window.chatEventListenersInitialized) {
        return;
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
    
    // Mark that we've set up the event listeners
    window.chatEventListenersInitialized = true;
})();
