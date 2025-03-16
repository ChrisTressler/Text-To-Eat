function updateGlobalCartState() {
    fetch('/api/get_cart')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                if (typeof window.cartItems !== 'undefined') {
                    window.cartItems = data.cart;
                }
                if (typeof window.cartTotal !== 'undefined') {
                    window.cartTotal = data.total;
                }

                if (typeof window.saveCartToLocalStorage === 'function') {
                    window.saveCartToLocalStorage();
                } else {
                    localStorage.setItem('cartItems', JSON.stringify(data.cart));
                    localStorage.setItem('cartTotal', data.total.toString());
                }

                if (typeof window.updateCartCountBadge === 'function') {
                    window.updateCartCountBadge();
                } else {
                    const cartCountBadge = document.getElementById('cart-count');
                    if (cartCountBadge) {
                        const itemCount = Object.keys(data.cart).length;
                        cartCountBadge.textContent = itemCount.toString();
                        cartCountBadge.style.display = itemCount > 0 ? 'flex' : 'none';
                    }
                }
                
                if (typeof window.updateCartDisplay === 'function') {
                    window.updateCartDisplay();
                }
                
                updateCartUI(data.cart, data.total);
                
                const event = new CustomEvent('cartUpdated', { 
                    detail: { 
                        cart: data.cart, 
                        total: data.total,
                        source: 'updateGlobalCartState'
                    } 
                });
                window.dispatchEvent(event);
            }
        })
        .catch(error => {
            console.error('Error fetching cart state:', error);
        });
}

function updateCartUI(cart, total) {
    const cartCountBadge = document.getElementById('cart-count');
    if (cartCountBadge) {
        const itemCount = Object.keys(cart).length;
        cartCountBadge.textContent = itemCount.toString();
        cartCountBadge.style.display = itemCount > 0 ? 'flex' : 'none';
    }
    
    const cartItemsDiv = document.getElementById('cart-items');
    if (cartItemsDiv) {
        cartItemsDiv.innerHTML = '';
        
        if (Object.keys(cart).length === 0) {
            cartItemsDiv.innerHTML = '<p>Your cart is empty.</p>';
            return;
        }
        
        const ul = document.createElement('ul');
        
        for (const [itemId, item] of Object.entries(cart)) {
            const li = document.createElement('li');
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = item.name;
            nameSpan.className = 'item-name';
            
            const quantitySpan = document.createElement('span');
            quantitySpan.textContent = 'x' + item.quantity;
            quantitySpan.className = 'item-quantity';
            
            const priceSpan = document.createElement('span');
            priceSpan.textContent = '$' + (item.price * item.quantity).toFixed(2);
            priceSpan.className = 'item-price';
            
            li.appendChild(nameSpan);
            li.appendChild(quantitySpan);
            li.appendChild(priceSpan);
            
            ul.appendChild(li);
        }
        
        cartItemsDiv.appendChild(ul);
        
        const cartTotalElement = document.getElementById('cart-total-price');
        if (cartTotalElement) {
            cartTotalElement.textContent = '$' + total.toFixed(2);
        }
    }
}

function setupChatInterface() {
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
            const currentOrderStr = localStorage.getItem('currentOrder');
            const currentOrder = currentOrderStr ? JSON.parse(currentOrderStr) : {"menuItems": [], "total": 0.0};
            
            const context = {
                message: message,
                currentOrder: currentOrder
            };
            
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(context),
            });
            
            const data = await response.json();
            
            removeTypingIndicator();
            addMessage(data.response);
            processChatResponse(data);
            
            if (data.order) {
                localStorage.setItem('currentOrder', JSON.stringify(data.order));
                
                if (data.removed_items && data.removed_items.length > 0) {
                    if (typeof window.forceCartRefresh === 'function') {
                        window.forceCartRefresh();
                    }
                    
                    setTimeout(() => {
                        if (typeof window.forceCartRefresh === 'function') {
                            window.forceCartRefresh();
                        }
                    }, 300);
                    
                    setTimeout(() => {
                        if (typeof window.forceCartRefresh === 'function') {
                            window.forceCartRefresh();
                        }
                    }, 800);
                }
                
                if (data.items && data.items.length > 0) {
                    if (typeof window.forceCartRefresh === 'function') {
                        window.forceCartRefresh();
                    }
                }
            }
            
            if (data.action === 'checkout') {
                window.location.href = '/checkout';
            }
            
        } catch (error) {
            console.error('Error:', error);
            removeTypingIndicator();
            addMessage('Sorry, I encountered an error. Please try again.');
        }
    }
    
    function processChatResponse(data) {
        if (data.removed_items && data.removed_items.length > 0) {
            updateCartAfterRemoval(data);
        }
        
        if (data.items && data.items.length > 0) {
            if (typeof window.fetchCartState === 'function') {
                window.fetchCartState();
            }
        }
        
        if (data.action === 'checkout') {
            window.location.href = '/checkout';
        }
    }

    function updateCartAfterRemoval(data) {
        if (data.order) {
            localStorage.setItem('currentOrder', JSON.stringify(data.order));
        }
        
        fetch('/api/get_cart', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            cache: 'no-store'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                if (typeof window.cartItems !== 'undefined') {
                    window.cartItems = data.cart;
                }
                
                if (typeof window.cartTotal !== 'undefined') {
                    window.cartTotal = data.total;
                }
                
                localStorage.setItem('cartItems', JSON.stringify(data.cart));
                localStorage.setItem('cartTotal', data.total.toString());
                
                if (typeof window.updateCartCountBadge === 'function') {
                    window.updateCartCountBadge();
                }
                
                if (typeof window.updateCartDisplay === 'function') {
                    window.updateCartDisplay();
                }
                
                const event = new CustomEvent('cartUpdated', { 
                    detail: { 
                        cart: data.cart, 
                        total: data.total,
                        source: 'llmRemoval' 
                    } 
                });
                window.dispatchEvent(event);
            }
        })
        .catch(error => {
            console.error("Error updating cart after LLM removal:", error);
        });
    }
    
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

document.addEventListener('DOMContentLoaded', function() {
    setupChatInterface();
    
    window.addEventListener('cartUpdated', function(e) {
        if (typeof window.updateCartDisplay === 'function') {
            window.updateCartDisplay();
        }
    });
    
    setTimeout(() => {
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages && chatMessages.children.length === 0) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message system';
            
            const messagePara = document.createElement('p');
            messagePara.textContent = "Welcome to McDonald's! How can I help you today? You can order items, remove them from your cart, or clear your cart completely.";
            
            messageDiv.appendChild(messagePara);
            chatMessages.appendChild(messageDiv);
        }
    }, 500);
});

window.addEventListener('storage', function(e) {
    if (e.key === 'cartItems' || e.key === 'cartTotal') {
        updateGlobalCartState();
    }
});

window.updateGlobalCartState = updateGlobalCartState;