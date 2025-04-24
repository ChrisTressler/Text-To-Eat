let cartItems = {};
let cartTotal = 0;
let currentItem = null;
let comboBaseItem = null;
let selectedDrink = null;

// Variables for suggestion modals
let suggestedItemType = null;
let suggestedItemId = null;
let currentSauces = [];
let currentSides = [];
let currentDrinks = [];
let selectedSauce = null;
let selectedSide = null;

function saveCartToLocalStorage() {
    localStorage.setItem('cartItems', JSON.stringify(cartItems));
    localStorage.setItem('cartTotal', cartTotal.toString());
}

function loadCartFromLocalStorage() {
    const storedItems = localStorage.getItem('cartItems');
    const storedTotal = localStorage.getItem('cartTotal');
    
    if (storedItems) {
        cartItems = JSON.parse(storedItems);
        cartTotal = parseFloat(storedTotal || '0');
        updateCartCountBadge();
        return true;
    }
    return false;
}

function openComboModal(item) {
    comboBaseItem = item;
    
    const comboBaseItemName = document.getElementById('combo-base-item-name');
    const comboBasePrice = document.getElementById('combo-base-price');
    const comboTotalPrice = document.getElementById('combo-total-price');
    const drinkOptions = document.getElementById('drink-options');
    const comboModal = document.getElementById('combo-modal');
    
    // Set item details - handle size variants
    let itemName = item.name;
    if (item.is_size_variant && item.available_sizes) {
        // If it's a size variant, include size in the name
        const currentSize = item.available_sizes.find(s => s.id === item.id);
        if (currentSize) {
            itemName = `${item.name} (${currentSize.size_name})`;
        }
    }
    
    comboBaseItemName.textContent = itemName;
    comboBasePrice.textContent = item.price.toFixed(2);
    
    // Define the base combo upcharge and standard drink price
    const baseComboUpcharge = 2.99;
    const standardDrinkPrice = 1.99;
    
    // Calculate initial combo total
    let comboTotal = item.price + baseComboUpcharge;
    comboTotalPrice.textContent = comboTotal.toFixed(2);
    
    // Clear previous drink options
    drinkOptions.innerHTML = '';
    selectedDrink = null;
    
    // Fetch available drinks
    fetch('/api/get_drinks', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Create radio buttons for each drink
            data.drinks.forEach(drink => {
                const drinkOption = document.createElement('div');
                drinkOption.className = 'drink-option';
                
                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = 'drink-choice';
                radio.id = 'drink-' + drink.id;
                radio.value = drink.id;
                
                // Calculate any extra cost if drink price is above standard
                const extraCost = Math.max(0, drink.price - standardDrinkPrice);
                
                radio.addEventListener('change', function() {
                    selectedDrink = drink;
                    
                    // Update the total price with any extra cost from premium drink
                    const newTotal = item.price + baseComboUpcharge + extraCost;
                    comboTotalPrice.textContent = newTotal.toFixed(2);
                    
                });
                
                const label = document.createElement('label');
                label.htmlFor = 'drink-' + drink.id;
                label.textContent = drink.name;
                
                // If there's an extra cost, show it in the label
                if (extraCost > 0) {
                    const extraCostSpan = document.createElement('span');
                    extraCostSpan.className = 'extra-cost';
                    extraCostSpan.textContent = ` (+$${extraCost.toFixed(2)})`;
                    label.appendChild(extraCostSpan);
                }
                
                drinkOption.appendChild(radio);
                drinkOption.appendChild(label);
                drinkOptions.appendChild(drinkOption);
            });
            
            // Select the first drink by default
            if (data.drinks.length > 0) {
                const firstRadio = document.querySelector('#drink-options input[type="radio"]');
                if (firstRadio) {
                    firstRadio.checked = true;
                    firstRadio.dispatchEvent(new Event('change'));
                    selectedDrink = data.drinks[0];
                }
            }
        } else {
            drinkOptions.innerHTML = '<p>No drinks available</p>';
        }
    })
    .catch(error => {
        console.error('Error fetching drinks:', error);
        drinkOptions.innerHTML = '<p>Failed to load drink options</p>';
    });
    
    // Show the modal
    comboModal.style.display = 'block';
}

function addComboToCart(baseItem, drinkItem) {
    if (!baseItem || !drinkItem) {
        showNotification('Please select a drink for your combo', 'error');
        return;
    }
    
    // Find the fries item
    fetch('/api/get_item_details', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ item_id: 'SIDE002' }),  // MEDIUM French Fries ID
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const friesItem = data.item;
            
            const standardDrinkPrice = 1.99;
            const baseComboUpcharge = 2.99;
            const drinkUpcharge = Math.max(0, drinkItem.price - standardDrinkPrice);
            const finalComboPrice = baseItem.price + baseComboUpcharge + drinkUpcharge;
            
            fetch('/api/add_combo_to_cart', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    base_item_id: baseItem.id,
                    fries_item_id: friesItem.id,
                    drink_item_id: drinkItem.id,
                    combo_price: finalComboPrice
                }),
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    cartItems = data.cart;
                    cartTotal = data.total;
                    
                    saveCartToLocalStorage();
                    updateCartCountBadge();
                    
                    showNotification('Combo meal added to cart!');
                    
                    document.getElementById('combo-modal').style.display = 'none';
                } else {
                    showNotification('Error: ' + data.message, 'error');
                }
            })
            .catch(error => {
                console.error('Error adding combo to cart:', error);
                showNotification('Error adding combo to cart', 'error');
            });
        } else {
            showNotification('Error getting fries information: ' + data.message, 'error');
        }
    })
    .catch(error => {
        console.error('Error getting fries details:', error);
        showNotification('Error getting fries details', 'error');
    });
}

function resetCartCompletely() {
    cartItems = {};
    cartTotal = 0;
    localStorage.removeItem('cartItems');
    localStorage.removeItem('cartTotal');
    
    updateCartCountBadge();
    
    return fetch('/api/clear_cart', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => response.json())
    .then(data => {
        return data;
    });
}

function forceCartRefresh() {
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
            window.cartItems = data.cart;
            window.cartTotal = data.total;
            
            localStorage.setItem('cartItems', JSON.stringify(data.cart));
            localStorage.setItem('cartTotal', data.total.toString());
            
            const cartCountBadge = document.getElementById('cart-count');
            if (cartCountBadge) {
                const itemCount = Array.isArray(data.cart) 
                    ? data.cart.length 
                    : Object.keys(data.cart).length;
                cartCountBadge.textContent = itemCount.toString();
                cartCountBadge.style.display = itemCount > 0 ? 'flex' : 'none';
            }
            
            if (typeof window.updateCartCountBadge === 'function') {
                window.updateCartCountBadge();
            }
            
            if (typeof window.updateCartDisplay === 'function') {
                window.updateCartDisplay();
            }
            
            const cartItemsDiv = document.getElementById('cart-items');
            if (cartItemsDiv) {
                cartItemsDiv.innerHTML = '';
                
                if (Object.keys(data.cart).length === 0) {
                    cartItemsDiv.innerHTML = '<p>Your cart is empty.</p>';
                } else {
                    const ul = document.createElement('ul');
                    
                    for (const [itemId, item] of Object.entries(data.cart)) {
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
                        
                        // Display notes if they exist
                        if (item.notes && item.notes.length > 0) {
                            const notesDiv = document.createElement('div');
                            notesDiv.className = 'item-notes';
                            notesDiv.textContent = item.notes;
                            li.appendChild(notesDiv);
                        }
                        
                        ul.appendChild(li);
                    }
                    
                    cartItemsDiv.appendChild(ul);
                }
                
                const cartTotalElement = document.getElementById('cart-total-price');
                if (cartTotalElement) {
                    cartTotalElement.textContent = '$' + data.total.toFixed(2);
                }
            }
            
            const event = new CustomEvent('cartUpdated', { 
                detail: { 
                    cart: data.cart, 
                    total: data.total,
                    source: 'forceCartRefresh'
                } 
            });
            window.dispatchEvent(event);
        }
    })
    .catch(error => {
        console.error('Error during force refresh:', error);
    });
}

window.forceCartRefresh = forceCartRefresh;

function completeOrder() {
    resetCartCompletely()
        .then(() => {
            window.location.href = '/';
        })
        .catch(error => {
            console.error('Error during order completion:', error);
        });
}

function fetchCartState() {
    if (loadCartFromLocalStorage()) {
        updateCartCountBadge();
    }
    
    fetch('/api/get_cart', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            cartItems = data.cart;
            cartTotal = data.total;
            saveCartToLocalStorage();
            
            updateCartCountBadge();
            
            if (typeof updateCartDisplay === 'function') {
                updateCartDisplay();
            }
        } else {
            console.error('Error loading cart state:', data.message);
        }
    })
    .catch(error => {
        console.error('Error fetching cart state:', error);
    });
}

window.fetchCartState = fetchCartState;

function updateCartCountBadge() {
    const cartCountBadge = document.getElementById('cart-count');
    if (!cartCountBadge) return;
    
    let totalItems = 0;
    
    if (Array.isArray(cartItems)) {
        // If cartItems is an array
        totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    } else if (cartItems && Object.keys(cartItems).length > 0) {
        // If cartItems is an object
        for (const item of Object.values(cartItems)) {
            totalItems += item.quantity;
        }
    }
    
    cartCountBadge.textContent = totalItems;
    
    if (totalItems === 0) {
        cartCountBadge.style.display = 'none';
    } else {
        cartCountBadge.style.display = 'flex';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const cartModal = document.getElementById('cart-modal');
    const cartBtn = document.getElementById('cart-btn');
    const closeBtn = document.querySelector('#cart-modal .close');
    const proceedCheckout = document.getElementById('proceed-checkout');
    
    const customizeModal = document.getElementById('customize-modal');
    const customizeCloseBtn = document.querySelector('#customize-modal .close');
    const cancelCustomizeBtn = document.getElementById('cancel-customize');
    const addCustomizedBtn = document.getElementById('add-customized');
    const customizeItemName = document.getElementById('customize-item-name');
    const currentIngredientsContainer = document.getElementById('current-ingredients');
    const freeAddOnsContainer = document.getElementById('free-add-ons');
    const paidAddOnsContainer = document.getElementById('paid-add-ons');
    const customizeBasePrice = document.getElementById('customize-base-price');
    const customizeExtrasPrice = document.getElementById('customize-extras-price');
    const customizeTotalPrice = document.getElementById('customize-total-price');
    
    const llmInput = document.getElementById('llm-input');
    const llmSubmit = document.getElementById('llm-submit');
    const chatMessages = document.getElementById('chat-messages');

    const comboModal = document.getElementById('combo-modal');
    const comboCloseBtn = document.querySelector('#combo-modal .close');
    const cancelComboBtn = document.getElementById('cancel-combo');
    const addComboBtn = document.getElementById('add-combo');
    
    fetchCartState();
    updateCartCountBadge();

    // Handle size selection dropdown changes
    document.addEventListener('change', function(event) {
        if (event.target.classList.contains('size-select')) {
            const menuItem = event.target.closest('.menu-item');
            const sizeSelect = event.target;
            const priceDisplay = menuItem.querySelector('.price');
            
            // Update the price based on the selected size option
            const selectedOption = sizeSelect.options[sizeSelect.selectedIndex];
            const price = selectedOption.dataset.price;
            
            if (price && priceDisplay) {
                priceDisplay.textContent = '$' + parseFloat(price).toFixed(2);
            }
            
            // Update the data-id attribute of the menu item to the selected size's ID
            menuItem.dataset.id = sizeSelect.value;
        }
    });

    if (cartBtn) {
        const originalClickHandler = cartBtn.onclick;
        cartBtn.onclick = function(event) {
            if (originalClickHandler) {
                originalClickHandler.call(this, event);
            }
            
            updateCartDisplay();
            cartModal.style.display = 'block';
        };
    }
    
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            cartModal.style.display = 'none';
        });
    }
    
    if (customizeCloseBtn) {
        customizeCloseBtn.addEventListener('click', function() {
            customizeModal.style.display = 'none';
        });
    }
    
    if (cancelCustomizeBtn) {
        cancelCustomizeBtn.addEventListener('click', function() {
            customizeModal.style.display = 'none';
        });
    }
    
    if (addCustomizedBtn) {
        addCustomizedBtn.addEventListener('click', function() {
            if (!currentItem) return;
            
            const removedIngredients = [];
            const addedIngredients = [];
            
            document.querySelectorAll('#current-ingredients input[type="checkbox"]').forEach(checkbox => {
                if (!checkbox.checked) {
                    removedIngredients.push(checkbox.value);
                }
            });
            
            document.querySelectorAll('#add-ons input[type="checkbox"]').forEach(checkbox => {
                if (checkbox.checked) {
                    addedIngredients.push(checkbox.value);
                }
            });
            
            console.log("Added ingredients:", addedIngredients);
            
            addToCartWithCustomization(currentItem.id, removedIngredients, addedIngredients);
            
            customizeModal.style.display = 'none';
        });
    }
    
    if (comboCloseBtn) {
        comboCloseBtn.addEventListener('click', function() {
            comboModal.style.display = 'none';
        });
    }
    
    if (cancelComboBtn) {
        cancelComboBtn.addEventListener('click', function() {
            comboModal.style.display = 'none';
        });
    }
    
    if (addComboBtn) {
        addComboBtn.addEventListener('click', function() {
            addComboToCart(comboBaseItem, selectedDrink);
        });
    }
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target === comboModal) {
            comboModal.style.display = 'none';
        }
    });
    
    // Handle combo button clicks
    document.addEventListener('click', function(event) {
        if (event.target.classList.contains('combo-btn')) {
            const menuItem = event.target.closest('.menu-item');
            let itemId = menuItem.dataset.id;
            
            // Check if this is a multi-size item with a size selector
            const sizeSelect = menuItem.querySelector('.size-select');
            if (sizeSelect) {
                itemId = sizeSelect.value;
            }
            
            fetch('/api/get_item_details', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ item_id: itemId }),
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    openComboModal(data.item);
                } else {
                    showNotification('Error: ' + data.message, 'error');
                }
            })
            .catch(error => {
                console.error('Error loading item details for combo:', error);
                showNotification('Error loading item details for combo', 'error');
            });
        }
    });

    window.addEventListener('click', function(event) {
        if (event.target === cartModal) {
            cartModal.style.display = 'none';
        }
        if (event.target === customizeModal) {
            customizeModal.style.display = 'none';
        }
    });
    
    if (proceedCheckout) {
        proceedCheckout.addEventListener('click', function() {
            window.location.href = '/checkout';
        });
    }
    
    document.addEventListener('click', function(event) {
        if (event.target.classList.contains('add-to-cart-btn')) {
            const menuItem = event.target.closest('.menu-item');
            let itemId = menuItem.dataset.id;
            
            // Check if this is a multi-size item with a size selector
            const sizeSelect = menuItem.querySelector('.size-select');
            if (sizeSelect) {
                itemId = sizeSelect.value;
            }
            
            fetch('/api/add_to_cart', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ item_id: itemId }),
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    cartItems = data.cart;
                    cartTotal = data.total;
                    
                    saveCartToLocalStorage();
                    
                    updateCartCountBadge();
                    
                    showNotification('Item added to cart!');
                    
                    // Handle suggestions using the helper function
                    handleItemSuggestion(data.suggestion, data.suggestion_type);
                } else {
                    showNotification('Error: ' + data.message, 'error');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showNotification('Error adding item to cart', 'error');
            });
        }
        
        if (event.target.classList.contains('customize-btn')) {
            const menuItem = event.target.closest('.menu-item');
            let itemId = menuItem.dataset.id;
            
            // Check if this is a multi-size item with a size selector
            const sizeSelect = menuItem.querySelector('.size-select');
            if (sizeSelect) {
                itemId = sizeSelect.value;
            }
            
            fetch('/api/get_item_details', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ item_id: itemId }),
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    openCustomizeModal(data.item);
                } else {
                    showNotification('Error: ' + data.message, 'error');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showNotification('Error loading item details', 'error');
                
                const mockItem = {
                    id: itemId,
                    name: menuItem.querySelector('h4').textContent,
                    price: parseFloat(menuItem.querySelector('.price').textContent.replace('$', '')),
                    ingredients: [],
                    customizable: true,
                    freeAddOns: [],
                    paidAddOns: []
                };
                openCustomizeModal(mockItem);
            });
        }
    });
    
    if (llmSubmit && llmInput) {
        llmSubmit.addEventListener('click', function() {
            const userInput = llmInput.value.trim();
            
            const userMsgDiv = document.createElement('div');
            userMsgDiv.className = 'message user';
            const userMsgPara = document.createElement('p');
            userMsgPara.textContent = userInput;
            userMsgDiv.appendChild(userMsgPara);
            chatMessages.appendChild(userMsgDiv);
            
            const typingIndicator = document.createElement('div');
            typingIndicator.className = 'typing-indicator';
            for (let i = 0; i < 3; i++) {
                const dot = document.createElement('span');
                typingIndicator.appendChild(dot);
            }
            chatMessages.appendChild(typingIndicator);
            
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
            llmInput.value = '';
            
            const orderItems = [];
            let orderTotal = 0;
            
            for (const [itemId, item] of Object.entries(cartItems)) {
                orderItems.push({
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity
                });
                orderTotal += item.price * item.quantity;
            }
            
            const currentOrder = {
                menuItems: orderItems,
                total: orderTotal
            };
            
            fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: userInput,
                    currentOrder: currentOrder
                }),
            })
            .then(response => response.json())
            .then(data => {
                chatMessages.removeChild(typingIndicator);
                
                const assistantMsgDiv = document.createElement('div');
                assistantMsgDiv.className = 'message system';
                const assistantMsgPara = document.createElement('p');
                assistantMsgPara.textContent = data.response;
                assistantMsgDiv.appendChild(assistantMsgPara);
                chatMessages.appendChild(assistantMsgDiv);
                
                if (data.items && data.items.length > 0) {
                    fetchCartState();
                    
                    showNotification(`Added ${data.items.length} item(s) to your cart`);
                }
                
                if (data.action === 'checkout') {
                    window.location.href = '/checkout';
                }
                
                chatMessages.scrollTop = chatMessages.scrollHeight;
            })
            .catch(error => {
                console.error('Error:', error);
                
                chatMessages.removeChild(typingIndicator);
                
                const errorMsgDiv = document.createElement('div');
                errorMsgDiv.className = 'message system';
                const errorMsgPara = document.createElement('p');
                errorMsgPara.textContent = 'Sorry, there was an error processing your request.';
                errorMsgDiv.appendChild(errorMsgPara);
                chatMessages.appendChild(errorMsgDiv);
                
                chatMessages.scrollTop = chatMessages.scrollHeight;
            });
        });
        
        llmInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                llmSubmit.click();
            }
        });
    }

    fetch('/api/get_cart', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success && Object.keys(data.cart).length === 0) {
            cartItems = {};
            cartTotal = 0;
            localStorage.removeItem('cartItems');
            localStorage.removeItem('cartTotal');
            updateCartCountBadge();
        }
    })
    .catch(error => {
        console.error('Error checking cart state:', error);
    });

    const menuItems = document.querySelectorAll('.menu-item[data-combo="true"]');
    menuItems.forEach(item => {
        const itemName = item.querySelector('h4');
        if (itemName) {
            const comboBadge = document.createElement('span');
            comboBadge.className = 'combo-badge';
            comboBadge.textContent = 'COMBO';
            itemName.appendChild(comboBadge);
        }
    });

    // Create sauce suggestion modal if it doesn't exist
    if (!document.getElementById('sauce-modal')) {
        const sauceModal = document.createElement('div');
        sauceModal.id = 'sauce-modal';
        sauceModal.className = 'modal';
        
        sauceModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <span class="close">&times;</span>
                    <h2>Would you like any sauce with that?</h2>
                </div>
                <div class="modal-body">
                    <div id="sauce-options" class="options-list">
                        <!-- Sauce options will be populated here -->
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="cancel-sauce" class="btn">No Thanks</button>
                    <button id="add-sauce" class="btn primary">Add Sauce</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(sauceModal);
        
        // Add event listeners
        document.querySelector('#sauce-modal .close').addEventListener('click', function() {
            sauceModal.style.display = 'none';
        });
        
        document.getElementById('cancel-sauce').addEventListener('click', function() {
            sauceModal.style.display = 'none';
        });
        
        document.getElementById('add-sauce').addEventListener('click', function() {
            addSelectedSauceToCart();
        });
        
        // Close modal when clicking outside
        window.addEventListener('click', function(event) {
            if (event.target === sauceModal) {
                sauceModal.style.display = 'none';
            }
        });
    }
    
    // Create entree suggestion modal if it doesn't exist
    if (!document.getElementById('entree-modal')) {
        const entreeModal = document.createElement('div');
        entreeModal.id = 'entree-modal';
        entreeModal.className = 'modal';
        
        entreeModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <span class="close">&times;</span>
                    <h2>Would you like to add drinks or sides?</h2>
                </div>
                <div class="modal-body">
                    <h3>Drinks</h3>
                    <div id="drink-entree-options" class="options-list">
                        <!-- Drink options will be populated here -->
                    </div>
                    <h3>Sides</h3>
                    <div id="side-options" class="options-list">
                        <!-- Side options will be populated here -->
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="cancel-entree" class="btn">No Thanks</button>
                    <button id="add-entree" class="btn primary">Add Selected Items</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(entreeModal);
        
        // Add event listeners
        document.querySelector('#entree-modal .close').addEventListener('click', function() {
            entreeModal.style.display = 'none';
        });
        
        document.getElementById('cancel-entree').addEventListener('click', function() {
            entreeModal.style.display = 'none';
        });
        
        document.getElementById('add-entree').addEventListener('click', function() {
            addSelectedSideAndDrinkToCart();
        });
        
        // Close modal when clicking outside
        window.addEventListener('click', function(event) {
            if (event.target === entreeModal) {
                entreeModal.style.display = 'none';
            }
        });
    }
});

function openCustomizeModal(item) {
    currentItem = item;
    
    const customizeItemName = document.getElementById('customize-item-name');
    const customizeBasePrice = document.getElementById('customize-base-price');
    const customizeTotalPrice = document.getElementById('customize-total-price');
    const currentIngredientsContainer = document.getElementById('current-ingredients');
    const addOnsContainer = document.getElementById('add-ons');
    
    // Set item name and price
    let displayName = item.name;
    
    customizeItemName.textContent = displayName;
    customizeBasePrice.textContent = item.price.toFixed(2);
    customizeTotalPrice.textContent = item.price.toFixed(2);
    
    // Clear existing containers
    currentIngredientsContainer.innerHTML = '';
    addOnsContainer.innerHTML = '';
    
    // If this is a size variant item, add a size selector
    if (item.is_size_variant && item.available_sizes && item.available_sizes.length > 1) {
        const sizeOptionsDiv = document.createElement('div');
        sizeOptionsDiv.className = 'size-options-customize';
        
        const sizeLabel = document.createElement('label');
        sizeLabel.textContent = isPieceCountItem(item.id) ? 'Piece Count:' : 'Size:';
        sizeOptionsDiv.appendChild(sizeLabel);
        
        const sizeSelect = document.createElement('select');
        sizeSelect.className = 'size-select';
        
        item.available_sizes.forEach(size => {
            const option = document.createElement('option');
            option.value = size.id;
            option.textContent = `${size.size_name} ($${size.price.toFixed(2)})`;
            option.dataset.price = size.price;
            
            // Select the current size
            if (size.id === item.id) {
                option.selected = true;
            }
            
            sizeSelect.appendChild(option);
        });
        
        // Add event listener to update prices when size changes
        sizeSelect.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            const newPrice = selectedOption.dataset.price;
            
            if (newPrice) {
                // Update the price displays
                customizeBasePrice.textContent = parseFloat(newPrice).toFixed(2);
                
                // Recalculate total with add-ons
                const extrasPrice = parseFloat(document.getElementById('customize-extras-price').textContent);
                customizeTotalPrice.textContent = (parseFloat(newPrice) + extrasPrice).toFixed(2);
                
                // Update the current item's price and ID
                currentItem.price = parseFloat(newPrice);
                currentItem.id = selectedOption.value;
            }
        });
        
        sizeOptionsDiv.appendChild(sizeSelect);
        currentIngredientsContainer.appendChild(sizeOptionsDiv);
    }
    
    // Populate current ingredients
    if (item.ingredients && item.ingredients.length > 0) {
        item.ingredients.forEach(ing => {
            const ingredientItem = document.createElement('div');
            ingredientItem.className = 'ingredient-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = true;
            checkbox.value = ing.id;
            checkbox.id = 'ing-' + ing.id;
            
            const label = document.createElement('label');
            label.htmlFor = 'ing-' + ing.id;
            label.textContent = ing.name;
            
            if (ing.price > 0) {
                const priceSpan = document.createElement('span');
                priceSpan.className = 'price';
                priceSpan.textContent = ' ($' + ing.price.toFixed(2) + ')';
                priceSpan.dataset.price = ing.price;
                label.appendChild(priceSpan);
            }
            
            ingredientItem.appendChild(checkbox);
            ingredientItem.appendChild(label);
            currentIngredientsContainer.appendChild(ingredientItem);
        });
    } else {
        const noIngredientsMsg = document.createElement('p');
        noIngredientsMsg.textContent = 'No customizable ingredients available.';
        currentIngredientsContainer.appendChild(noIngredientsMsg);
    }
    
    // Populate available add-ons
    if (item.available_extras && item.available_extras.length > 0) {
        // Group add-ons by price (free vs. paid)
        const freeAddOns = [];
        const paidAddOns = [];
        
        item.available_extras.forEach(extra => {
            if (extra.price <= 0) {
                freeAddOns.push(extra);
            } else {
                paidAddOns.push(extra);
            }
        });
        
        // Add free add-ons with a header
        if (freeAddOns.length > 0) {
            const freeHeader = document.createElement('div');
            freeHeader.className = 'add-on-group-header';
            freeHeader.textContent = 'Free Add-Ons';
            addOnsContainer.appendChild(freeHeader);
            
            freeAddOns.forEach(addOn => {
                addAddOnToContainer(addOn, addOnsContainer, true);
            });
            
            // Add a divider if there are also paid add-ons
            if (paidAddOns.length > 0) {
                const divider = document.createElement('hr');
                addOnsContainer.appendChild(divider);
            }
        }
        
        // Add paid add-ons with a header
        if (paidAddOns.length > 0) {
            const paidHeader = document.createElement('div');
            paidHeader.className = 'add-on-group-header';
            paidHeader.textContent = 'Premium Add-Ons';
            addOnsContainer.appendChild(paidHeader);
            
            paidAddOns.forEach(addOn => {
                addAddOnToContainer(addOn, addOnsContainer, false);
            });
        }
    } else {
        const noAddOnsMsg = document.createElement('p');
        noAddOnsMsg.textContent = 'No add-ons available for this item.';
        addOnsContainer.appendChild(noAddOnsMsg);
    }
    
    // Show the modal
    document.getElementById('customize-modal').style.display = 'block';
}

function addAddOnToContainer(addOn, container, isFree) {
    const addOnItem = document.createElement('div');
    addOnItem.className = 'ingredient-item';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = false;
    checkbox.value = addOn.id;
    checkbox.id = 'addon-' + addOn.id;
    
    checkbox.addEventListener('change', updateCustomizationPrice);
    
    const label = document.createElement('label');
    label.htmlFor = 'addon-' + addOn.id;
    label.textContent = addOn.name;
    
    const priceSpan = document.createElement('span');
    priceSpan.className = isFree ? 'price free' : 'price';
    priceSpan.textContent = isFree ? ' (Free)' : ' ($' + addOn.price.toFixed(2) + ')';
    priceSpan.dataset.price = addOn.price;
    label.appendChild(priceSpan);
    
    addOnItem.appendChild(checkbox);
    addOnItem.appendChild(label);
    container.appendChild(addOnItem);
}

function updateCustomizationPrice() {
    if (!currentItem) return;
    
    let extrasTotal = 0;
    
    // Calculate price for all paid add-ons
    document.querySelectorAll('#add-ons input[type="checkbox"]').forEach(checkbox => {
        if (checkbox.checked) {
            const priceElement = checkbox.nextElementSibling.querySelector('.price');
            if (priceElement && priceElement.dataset.price && !priceElement.classList.contains('free')) {
                extrasTotal += parseFloat(priceElement.dataset.price);
            }
        }
    });
    
    // Update price displays
    const customizeExtrasPrice = document.getElementById('customize-extras-price');
    const customizeBasePrice = document.getElementById('customize-base-price');
    const customizeTotalPrice = document.getElementById('customize-total-price');
    
    if (customizeExtrasPrice && customizeBasePrice && customizeTotalPrice) {
        customizeExtrasPrice.textContent = extrasTotal.toFixed(2);
        customizeTotalPrice.textContent = (parseFloat(customizeBasePrice.textContent) + extrasTotal).toFixed(2);
    }
}

function addToCartWithCustomization(itemId, removedIngredients, addedIngredients) {
    fetch('/api/add_customized_item', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            item_id: itemId,
            removed_ingredients: removedIngredients,
            added_ingredients: addedIngredients
        }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            cartItems = data.cart;
            cartTotal = data.total;
            
            saveCartToLocalStorage();
            updateCartCountBadge();
            updateCartDisplay();
            
            showNotification('Customized item added to cart!');
            
            // Handle suggestions using the helper function
            handleItemSuggestion(data.suggestion, data.suggestion_type);
        } else {
            showNotification('Error: ' + data.message, 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('Error adding customized item to cart', 'error');
        
        showNotification('Customized item added to cart!');
    });
}

function updateCartDisplay() {
    const cartItemsDiv = document.getElementById('cart-items');
    const cartTotalPrice = document.getElementById('cart-total-price');
    
    if (!cartItemsDiv || !cartTotalPrice) return;
    
    cartItemsDiv.innerHTML = '';
    
    // Check if cartItems is empty
    const isCartEmpty = Array.isArray(cartItems) 
        ? cartItems.length === 0 
        : Object.keys(cartItems).length === 0;
    
    if (isCartEmpty) {
        cartItemsDiv.innerHTML = '<p>Your cart is empty.</p>';
        cartTotalPrice.textContent = '$0.00';
        return;
    }
    
    const ul = document.createElement('ul');
    
    // Handle both array and object formats of cartItems
    const itemsToDisplay = Array.isArray(cartItems) 
        ? cartItems 
        : Object.values(cartItems);
    
    for (const item of itemsToDisplay) {
        const li = document.createElement('li');
        li.dataset.itemId = item.id;
        
        // Check if this is a combo meal
        if (item.is_combo) {
            li.className = 'cart-combo-item';
            
            // Add premium class if this combo has a premium drink
            if (item.has_premium_drink) {
                li.classList.add('premium-combo');
            }
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = item.name;
            nameSpan.className = 'item-name';
            
            // Add premium drink badge if applicable
            if (item.has_premium_drink) {
                const premiumBadge = document.createElement('span');
                premiumBadge.className = 'premium-badge';
                premiumBadge.textContent = 'PREMIUM';
                nameSpan.appendChild(premiumBadge);
            }
            
            const quantitySpan = document.createElement('span');
            quantitySpan.textContent = 'x' + item.quantity;
            quantitySpan.className = 'item-quantity';
            
            const priceSpan = document.createElement('span');
            priceSpan.textContent = '$' + (item.price * item.quantity).toFixed(2);
            priceSpan.className = 'item-price';
            
            // Add premium info if available
            if (item.premium_info && item.premium_info.length > 0) {
                const premiumInfo = document.createElement('span');
                premiumInfo.className = 'premium-info';
                premiumInfo.textContent = item.premium_info;
                priceSpan.appendChild(premiumInfo);
            }
            
            const comboComponentsList = document.createElement('ul');
            comboComponentsList.className = 'combo-components';
            
            // Add each combo component
            item.combo_items.forEach(component => {
                const componentLi = document.createElement('li');
                componentLi.textContent = component.name;
                
                // Mark premium drinks
                if (component.is_premium) {
                    componentLi.classList.add('premium-item');
                }
                
                comboComponentsList.appendChild(componentLi);
            });
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-item-btn';
            removeBtn.innerHTML = '<i class="fas fa-trash"></i>';
            removeBtn.title = 'Remove combo';
            removeBtn.addEventListener('click', function() {
                removeFromCart(item.id);
            });
            
            const decreaseBtn = document.createElement('button');
            decreaseBtn.className = 'decrease-qty-btn';
            decreaseBtn.innerHTML = '<i class="fas fa-minus"></i>';
            decreaseBtn.title = 'Decrease quantity';
            decreaseBtn.addEventListener('click', function() {
                removeFromCart(item.id, true);
            });
            
            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'item-actions';
            actionsContainer.appendChild(decreaseBtn);
            actionsContainer.appendChild(removeBtn);
            
            li.appendChild(nameSpan);
            li.appendChild(quantitySpan);
            li.appendChild(priceSpan);
            li.appendChild(comboComponentsList);
            
            // Display notes if they exist
            if (item.notes && item.notes.length > 0) {
                const notesDiv = document.createElement('div');
                notesDiv.className = 'item-notes';
                notesDiv.textContent = item.notes;
                li.appendChild(notesDiv);
            }
            
            li.appendChild(actionsContainer);
        } else {
            // Regular non-combo item (unchanged)
            const nameSpan = document.createElement('span');
            nameSpan.textContent = item.name;
            nameSpan.className = 'item-name';
            
            const quantitySpan = document.createElement('span');
            quantitySpan.textContent = 'x' + item.quantity;
            quantitySpan.className = 'item-quantity';
            
            const priceSpan = document.createElement('span');
            priceSpan.textContent = '$' + (item.price * item.quantity).toFixed(2);
            priceSpan.className = 'item-price';
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-item-btn';
            removeBtn.innerHTML = '<i class="fas fa-trash"></i>';
            removeBtn.title = 'Remove item';
            removeBtn.addEventListener('click', function() {
                removeFromCart(item.id);
            });
            
            const decreaseBtn = document.createElement('button');
            decreaseBtn.className = 'decrease-qty-btn';
            decreaseBtn.innerHTML = '<i class="fas fa-minus"></i>';
            decreaseBtn.title = 'Decrease quantity';
            decreaseBtn.addEventListener('click', function() {
                removeFromCart(item.id, true);
            });
            
            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'item-actions';
            actionsContainer.appendChild(decreaseBtn);
            actionsContainer.appendChild(removeBtn);
            
            li.appendChild(nameSpan);
            li.appendChild(quantitySpan);
            li.appendChild(priceSpan);
            
            // Display notes if they exist
            if (item.notes && item.notes.length > 0) {
                const notesDiv = document.createElement('div');
                notesDiv.className = 'item-notes';
                notesDiv.textContent = item.notes;
                li.appendChild(notesDiv);
            }
            
            li.appendChild(actionsContainer);
        }
        
        ul.appendChild(li);
    }
    
    cartItemsDiv.appendChild(ul);
    cartTotalPrice.textContent = '$' + cartTotal.toFixed(2);
}

function removeFromCart(itemId, decreaseOnly = false) {
    // Find the item in the cart array
    let itemIndex = -1;
    if (Array.isArray(cartItems)) {
        // If cartItems is already an array (from API)
        itemIndex = cartItems.findIndex(item => item.id === itemId);
    } else {
        // If cartItems is still an object (from localStorage)
        itemIndex = Object.values(cartItems).findIndex(item => item.id === itemId);
    }
    
    if (itemIndex === -1) {
        console.error('Item not found in cart:', itemId);
        showNotification('Error: Item not found in cart', 'error');
        return;
    }

    fetch('/api/remove_from_cart', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            item_id: itemId,
            decrease_only: decreaseOnly
        }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            cartItems = data.cart;
            cartTotal = data.total;
            
            saveCartToLocalStorage();
            
            updateCartDisplay();
            
            updateCartCountBadge();
            
            showNotification(decreaseOnly ? 'Item quantity decreased' : 'Item removed from cart');
        } else {
            showNotification('Error: ' + data.message, 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('Error removing item from cart', 'error');
    });
}

window.clearCart = function() {
    cartItems = {};
    cartTotal = 0;
    localStorage.removeItem('cartItems');
    localStorage.removeItem('cartTotal');
    updateCartCountBadge();
    updateCartDisplay();
    showNotification('Cart cleared!');
};

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = 'notification ' + type;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

window.showNotification = showNotification;

const notificationStyle = document.createElement('style');
notificationStyle.textContent = `
    .notification {
        position: fixed;
        top: 70px;
        right: 20px;
        padding: 10px 15px;
        border-radius: 4px;
        color: white;
        font-weight: bold;
        opacity: 0;
        transform: translateY(-20px);
        transition: opacity 0.3s, transform 0.3s;
        z-index: 2000;
    }
    
    .notification.show {
        opacity: 1;
        transform: translateY(0);
    }
    
    .notification.success {
        background-color: #4CAF50;
    }
    
    .notification.error {
        background-color: #f44336;
    }
    
    .item-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-left: 15px;
    }
    
    .item-notes {
        font-size: 0.85rem;
        color: #666;
        font-style: italic;
        margin: 4px 0;
        padding-left: 10px;
        border-left: 2px solid #ffbc0d;
        width: 100%;
    }
    
    .remove-item-btn, .decrease-qty-btn {
        background: none;
        border: none;
        color: #999;
        cursor: pointer;
        font-size: 1rem;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: color 0.3s, background-color 0.3s;
    }
    
    .remove-item-btn:hover {
        color: #f44336;
        background-color: rgba(244, 67, 54, 0.1);
    }
    
    .decrease-qty-btn:hover {
        color: #ffbc0d;
        background-color: rgba(255, 188, 13, 0.1);
    }
    
    #cart-items li {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 0;
        border-bottom: 1px solid #eee;
    }
    
    .clear-cart-btn {
        background-color: #f5f5f5;
        color: #666;
        border: none;
        border-radius: 4px;
        padding: 6px 12px;
        font-size: 0.9rem;
        cursor: pointer;
        margin-bottom: 15px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        transition: background-color 0.3s;
    }
    
    .clear-cart-btn:hover {
        background-color: #e0e0e0;
        color: #f44336;
    }
    
    .clear-cart-btn i {
        font-size: 0.85rem;
    }
    
    .cart-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
    }

    /* Additional styles for customization sections */
    #current-ingredients-section,
    #free-add-ons-section,
    #paid-add-ons-section {
        margin-top: 20px;
    }
    
    #current-ingredients-section h4,
    #free-add-ons-section h4,
    #paid-add-ons-section h4 {
        border-bottom: 1px solid #eee;
        padding-bottom: 5px;
        margin-bottom: 10px;
    }
`;

document.addEventListener('DOMContentLoaded', function() {
    document.head.appendChild(notificationStyle);
    
    setTimeout(() => {
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages && chatMessages.children.length === 0) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message system';
            
            const messagePara = document.createElement('p');
            messagePara.textContent = "Welcome to Text-To-Eat! How can I help you today?";
            
            messageDiv.appendChild(messagePara);
            chatMessages.appendChild(messageDiv);
        }
    }, 500);
});

// Function to open the sauce suggestion modal
function openSauceSuggestionModal(itemId) {
    suggestedItemType = 'sauce';
    suggestedItemId = itemId;
    selectedSauce = null;
    
    const sauceModal = document.getElementById('sauce-modal');
    const sauceOptions = document.getElementById('sauce-options');
    
    // Clear previous sauce options
    sauceOptions.innerHTML = '';
    
    // Fetch available sauces
    fetch('/api/get_sauces', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            currentSauces = data.sauces;
            
            // Create radio buttons for each sauce
            data.sauces.forEach(sauce => {
                const sauceOption = document.createElement('div');
                sauceOption.className = 'sauce-option';
                
                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = 'sauce-choice';
                radio.id = 'sauce-' + sauce.id;
                radio.value = sauce.id;
                
                radio.addEventListener('change', function() {
                    selectedSauce = sauce;
                });
                
                const label = document.createElement('label');
                label.htmlFor = 'sauce-' + sauce.id;
                label.textContent = sauce.name;
                
                // If there's a price, show it in the label
                if (sauce.price > 0) {
                    const priceSpan = document.createElement('span');
                    priceSpan.className = 'price';
                    priceSpan.textContent = ` (+$${sauce.price.toFixed(2)})`;
                    label.appendChild(priceSpan);
                }
                
                sauceOption.appendChild(radio);
                sauceOption.appendChild(label);
                sauceOptions.appendChild(sauceOption);
            });
            
            // Add "No sauce" option
            const noSauceOption = document.createElement('div');
            noSauceOption.className = 'sauce-option';
            
            const noSauceRadio = document.createElement('input');
            noSauceRadio.type = 'radio';
            noSauceRadio.name = 'sauce-choice';
            noSauceRadio.id = 'sauce-none';
            noSauceRadio.value = 'none';
            noSauceRadio.checked = true; // Default selection
            
            noSauceRadio.addEventListener('change', function() {
                selectedSauce = null;
            });
            
            const noSauceLabel = document.createElement('label');
            noSauceLabel.htmlFor = 'sauce-none';
            noSauceLabel.textContent = 'No sauce, thanks';
            
            noSauceOption.appendChild(noSauceRadio);
            noSauceOption.appendChild(noSauceLabel);
            sauceOptions.appendChild(noSauceOption);
            
            // Show the modal
            sauceModal.style.display = 'block';
        } else {
            showNotification('Error loading sauces', 'error');
        }
    })
    .catch(error => {
        console.error('Error fetching sauces:', error);
        showNotification('Error fetching sauces', 'error');
    });
}

// Function to add selected sauce to cart
function addSelectedSauceToCart() {
    const sauceModal = document.getElementById('sauce-modal');
    
    if (selectedSauce) {
        fetch('/api/add_to_cart', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ item_id: selectedSauce.id }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                cartItems = data.cart;
                cartTotal = data.total;
                
                saveCartToLocalStorage();
                updateCartCountBadge();
                
                showNotification(`Added ${selectedSauce.name} to your order!`);
            }
        })
        .catch(error => {
            console.error('Error adding sauce to cart:', error);
        });
    }
    
    sauceModal.style.display = 'none';
}

// Function to open the entree suggestion modal (sides only)
function openEntreeSuggestionModal(itemId) {
    suggestedItemType = 'entree';
    suggestedItemId = itemId;
    selectedSide = null;
    selectedDrink = null; // Reset the drink selection
    
    const entreeModal = document.getElementById('entree-modal');
    const sideOptions = document.getElementById('side-options');
    const drinkOptions = document.getElementById('drink-entree-options');
    
    // Clear previous side options
    sideOptions.innerHTML = '';
    drinkOptions.innerHTML = '';
    
    // Debug message to help troubleshoot
    console.log('Opening entree suggestion modal, cleared side container');
    
    // Fetch sides data
    console.log('Fetching sides data...');
    fetch('/api/get_sides', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            currentSides = data.sides;
            console.log('Received sides data:', data.sides);
            
            const sideOptionsContainer = document.getElementById('side-options');
            if (!sideOptionsContainer) {
                console.error('Could not find side-options container');
                return;
            }
            
            // Clear just to be safe
            sideOptionsContainer.innerHTML = '';
            
            // Create radio buttons for each side
            data.sides.forEach(side => {
                const sideOption = document.createElement('div');
                sideOption.className = 'side-option';
                
                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = 'side-choice';
                radio.id = 'side-' + side.id;
                radio.value = side.id;
                
                radio.addEventListener('change', function() {
                    selectedSide = side;
                });
                
                const label = document.createElement('label');
                label.htmlFor = 'side-' + side.id;
                label.textContent = side.name;
                
                const priceSpan = document.createElement('span');
                priceSpan.className = 'price';
                priceSpan.textContent = ` ($${side.price.toFixed(2)})`;
                label.appendChild(priceSpan);
                
                sideOption.appendChild(radio);
                sideOption.appendChild(label);
                sideOptionsContainer.appendChild(sideOption);
            });
            
            // Add "No side" option
            const noSideOption = document.createElement('div');
            noSideOption.className = 'side-option';
            
            const noSideRadio = document.createElement('input');
            noSideRadio.type = 'radio';
            noSideRadio.name = 'side-choice';
            noSideRadio.id = 'side-none';
            noSideRadio.value = 'none';
            noSideRadio.checked = true; // Default selection
            
            noSideRadio.addEventListener('change', function() {
                selectedSide = null;
            });
            
            const noSideLabel = document.createElement('label');
            noSideLabel.htmlFor = 'side-none';
            noSideLabel.textContent = 'No side, thanks';
            
            noSideOption.appendChild(noSideRadio);
            noSideOption.appendChild(noSideLabel);
            sideOptionsContainer.appendChild(noSideOption);
            
            // Show the modal
            entreeModal.style.display = 'block';
            console.log('Entree modal is now displayed with sides only');
        } else {
            showNotification('Error loading sides', 'error');
            throw new Error('Failed to load sides');
        }
    })
    .catch(error => {
        console.error('Error fetching sides:', error);
        showNotification('Error fetching suggestions', 'error');
    });

    fetch('/api/get_drinks', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            currentDrinks = data.drinks; // Fix variable name
            console.log('Received drinks data:', data.drinks);
            
            const drinkOptionsContainer = document.getElementById('drink-entree-options');
            if (!drinkOptionsContainer) {
                console.error('Could not find drink-options container');
                return;
            }
            
            // Clear just to be safe
            drinkOptionsContainer.innerHTML = '';
            
            // Create radio buttons for each drink
            data.drinks.forEach(drink => {
                const drinkOption = document.createElement('div');
                drinkOption.className = 'drink-option';
                
                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = 'drink-choice';
                radio.id = 'drink-' + drink.id;
                radio.value = drink.id;
                
                radio.addEventListener('change', function() {
                    selectedDrink = drink; // Fix variable name
                });
                
                const label = document.createElement('label');
                label.htmlFor = 'drink-' + drink.id;
                label.textContent = drink.name;
                
                const priceSpan = document.createElement('span');
                priceSpan.className = 'price';
                priceSpan.textContent = ` ($${drink.price.toFixed(2)})`;
                label.appendChild(priceSpan);
                
                drinkOption.appendChild(radio);
                drinkOption.appendChild(label);
                drinkOptionsContainer.appendChild(drinkOption);
            });
            
            // Add "No drink" option
            const noDrinkOption = document.createElement('div');
            noDrinkOption.className = 'drink-option';
            
            const noDrinkRadio = document.createElement('input');
            noDrinkRadio.type = 'radio';
            noDrinkRadio.name = 'drink-choice';
            noDrinkRadio.id = 'drink-none';
            noDrinkRadio.value = 'none';
            noDrinkRadio.checked = true; // Default selection
            
            noDrinkRadio.addEventListener('change', function() {
                selectedDrink = null; // Fix variable name
            });
            
            const noDrinkLabel = document.createElement('label');
            noDrinkLabel.htmlFor = 'drink-none';
            noDrinkLabel.textContent = 'No drink, thanks';
            
            noDrinkOption.appendChild(noDrinkRadio);
            noDrinkOption.appendChild(noDrinkLabel);
            drinkOptionsContainer.appendChild(noDrinkOption);
            
            // Show the modal
            entreeModal.style.display = 'block';
            console.log('Entree modal is now displayed with drinks only');
        } else {
            showNotification('Error loading drinks', 'error');
            throw new Error('Failed to load drinks');
        }
    })
    .catch(error => {
        console.error('Error fetching drinks:', error);
        showNotification('Error fetching suggestions', 'error');
    });
}

// Add a helper function to handle suggestion routing
function handleItemSuggestion(suggestion, suggestionType) {
    if (!suggestion || !suggestionType) {
        return;
    }
    
    console.log("Handling suggestion type:", suggestionType);
    
    if (suggestionType === 'sauce') {
        openSauceSuggestionModal(suggestion.item_id);
    } else if (suggestionType === 'entree') {
        openEntreeSuggestionModal(suggestion.item_id);
    }
}

// Function to add selected side and drink to cart
function addSelectedSideAndDrinkToCart() {
    const entreeModal = document.getElementById('entree-modal');
    const itemsToAdd = [];
    
    if (selectedSide) {
        itemsToAdd.push({ id: selectedSide.id });
    }
    
    if (selectedDrink) {
        itemsToAdd.push({ id: selectedDrink.id });
    }
    
    if (itemsToAdd.length > 0) {
        // Use the multiple_items endpoint if we have both items
        if (itemsToAdd.length > 1) {
            fetch('/api/add_to_cart', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    multiple_items: true,
                    items: itemsToAdd
                }),
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    cartItems = data.cart;
                    cartTotal = data.total;
                    
                    saveCartToLocalStorage();
                    updateCartCountBadge();
                    
                    let message = '';
                    if (selectedSide && selectedDrink) {
                        message = `Added ${selectedSide.name} and ${selectedDrink.name} to your order!`;
                    }
                    
                    if (message) {
                        showNotification(message);
                    }
                }
            })
            .catch(error => {
                console.error('Error adding multiple items to cart:', error);
                showNotification('Error adding items to cart', 'error');
            });
        } else {
            // Use the single item endpoint if we only have one item
            const singleItem = itemsToAdd[0];
            fetch('/api/add_to_cart', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ item_id: singleItem.id }),
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    cartItems = data.cart;
                    cartTotal = data.total;
                    
                    saveCartToLocalStorage();
                    updateCartCountBadge();
                    
                    let message = '';
                    if (selectedSide) {
                        message = `Added ${selectedSide.name} to your order!`;
                    } else if (selectedDrink) {
                        message = `Added ${selectedDrink.name} to your order!`;
                    }
                    
                    if (message) {
                        showNotification(message);
                    }
                }
            })
            .catch(error => {
                console.error('Error adding item to cart:', error);
                showNotification('Error adding item to cart', 'error');
            });
        }
    }
    
    entreeModal.style.display = 'none';
}

// Add styles for the new modals
const suggestionModalStyle = document.createElement('style');
suggestionModalStyle.textContent = `
    .options-list {
        max-height: 300px;
        overflow-y: auto;
        margin-bottom: 20px;
    }
    
    .sauce-option, .side-option, .drink-option {
        display: flex;
        align-items: center;
        margin-bottom: 10px;
        padding: 10px;
        border-radius: 4px;
        transition: background-color 0.2s;
    }
    
    .sauce-option:hover, .side-option:hover, .drink-option:hover {
        background-color: #f5f5f5;
    }
    
    .sauce-option input, .side-option input, .drink-option input {
        margin-right: 10px;
    }
    
    .sauce-option label, .side-option label, .drink-option label {
        flex: 1;
        cursor: pointer;
    }
    
    .sauce-option .price, .side-option .price, .drink-option .price {
        color: #666;
        font-size: 0.9em;
    }
`;

document.addEventListener('DOMContentLoaded', function() {
    document.head.appendChild(suggestionModalStyle);
    // ... existing code ...
});

// Add a helper function to determine if an item is a piece count item
function isPieceCountItem(itemId) {
    // Check if this is a nugget or mozzarella stick item
    return itemId && (itemId.includes('NUG') || itemId.includes('SIDE006'));
}

// Add a helper function to format size name for display
function formatSizeName(itemId, sizeName) {
    if (isPieceCountItem(itemId)) {
        // For piece count items, just return the size name (which should be like "4 pc", "6 pc", etc.)
        return sizeName;
    } else {
        // For regular size items, return the standard format
        return sizeName;
    }
}
