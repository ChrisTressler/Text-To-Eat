let cartItems = {};
let cartTotal = 0;
let currentItem = null;
let comboBaseItem = null;
let selectedDrink = null;

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
    
    // Set item details
    comboBaseItemName.textContent = item.name;
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
    fetch('/api/get_category_items', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category: 'drinks' }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Create radio buttons for each drink
            data.items.forEach(drink => {
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
            if (data.items.length > 0) {
                const firstRadio = document.querySelector('#drink-options input[type="radio"]');
                if (firstRadio) {
                    firstRadio.checked = true;
                    firstRadio.dispatchEvent(new Event('change'));
                    selectedDrink = data.items[0];
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
                const itemCount = Object.keys(data.cart).length;
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
    
    if (cartItems && Object.keys(cartItems).length > 0) {
        for (const [itemId, item] of Object.entries(cartItems)) {
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
            
            document.querySelectorAll('#free-add-ons input[type="checkbox"], #paid-add-ons input[type="checkbox"]').forEach(checkbox => {
                if (checkbox.checked) {
                    addedIngredients.push(checkbox.value);
                }
            });
            
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
            const itemId = menuItem.dataset.id;
            
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
            const itemId = menuItem.dataset.id;
            
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
            const itemId = menuItem.dataset.id;
            
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
            
            if (userInput === '') {
                showNotification('Please enter your order', 'error');
                return;
            }
            
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
});

function openCustomizeModal(item) {
    currentItem = item;
    
    const customizeItemName = document.getElementById('customize-item-name');
    const currentIngredientsContainer = document.getElementById('current-ingredients');
    const addOnsContainer = document.getElementById('add-ons');
    const customizeBasePrice = document.getElementById('customize-base-price');
    const customizeExtrasPrice = document.getElementById('customize-extras-price');
    const customizeTotalPrice = document.getElementById('customize-total-price');
    const customizeModal = document.getElementById('customize-modal');
    
    if (!addOnsContainer) {
        // If the add-ons container doesn't exist yet, create it in the correct place
        const ingredientControls = document.querySelector('#customize-modal .ingredient-controls');
        if (ingredientControls) {
            const addOnsHeader = document.createElement('h4');
            addOnsHeader.textContent = 'Add-Ons';
            ingredientControls.appendChild(addOnsHeader);
            
            const newAddOnsContainer = document.createElement('div');
            newAddOnsContainer.id = 'add-ons';
            newAddOnsContainer.className = 'ingredients-list';
            ingredientControls.appendChild(newAddOnsContainer);
        }
    }
    
    customizeItemName.textContent = item.name;
    customizeBasePrice.textContent = item.price.toFixed(2);
    customizeExtrasPrice.textContent = '0.00';
    customizeTotalPrice.textContent = item.price.toFixed(2);
    
    // Clear containers 
    currentIngredientsContainer.innerHTML = '';
    
    const updatedAddOnsContainer = document.getElementById('add-ons');
    if (updatedAddOnsContainer) {
        updatedAddOnsContainer.innerHTML = '';
    } else {
        console.error('Could not find or create add-ons container');
        return;
    }
    
    // Populate current ingredients
    if (item.ingredients && item.ingredients.length > 0) {
        item.ingredients.forEach(ing => {
            const ingredientDiv = document.createElement('div');
            ingredientDiv.className = 'ingredient-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = 'ing-' + ing.id;
            checkbox.value = ing.id;
            checkbox.checked = true;
            
            const label = document.createElement('label');
            label.htmlFor = 'ing-' + ing.id;
            label.textContent = ing.name;
            
            ingredientDiv.appendChild(checkbox);
            ingredientDiv.appendChild(label);
            
            currentIngredientsContainer.appendChild(ingredientDiv);
        });
    } else {
        currentIngredientsContainer.innerHTML = '<p>No ingredients to customize</p>';
    }
    
    const allAddOns = [];
    
    // Add Extra versions of current ingredients
    if (item.ingredients && item.ingredients.length > 0) {
        item.ingredients.forEach(ing => {
            allAddOns.push({
                id: 'extra-' + ing.id,
                value: ing.id,
                name: 'Extra ' + ing.name,
                price: ing.price,
                isPaid: true
            });
        });
    }
    
    // Add paid add-ons
    if (item.paidAddOns && item.paidAddOns.length > 0) {
        item.paidAddOns.forEach(ing => {
            allAddOns.push({
                id: 'paid-' + ing.id,
                value: ing.id,
                name: ing.name,
                price: ing.price,
                isPaid: true
            });
        });
    }
    
    // Add free add-ons
    if (item.freeAddOns && item.freeAddOns.length > 0) {
        item.freeAddOns.forEach(ing => {
            allAddOns.push({
                id: 'free-' + ing.id,
                value: ing.id,
                name: ing.name,
                price: 0,
                isPaid: false
            });
        });
    }
    
    // Sort alphabetically but keep free items at the bottom
    allAddOns.sort((a, b) => {
        // If one is paid and the other is free, paid comes first
        if (a.isPaid && !b.isPaid) return -1;
        if (!a.isPaid && b.isPaid) return 1;
        
        // If both are the same type, sort alphabetically
        return a.name.localeCompare(b.name);
    });
    
    // Add all add-ons to the container
    allAddOns.forEach(addon => {
        const ingredientDiv = document.createElement('div');
        ingredientDiv.className = 'ingredient-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = addon.id;
        checkbox.value = addon.value;
        checkbox.checked = false;
        if (addon.isPaid) {
            checkbox.addEventListener('change', updateCustomizationPrice);
        }
        
        const label = document.createElement('label');
        label.htmlFor = addon.id;
        label.textContent = addon.name;
        
        const price = document.createElement('span');
        price.className = addon.isPaid ? 'price' : 'price free';
        price.textContent = addon.isPaid ? ` (+$${addon.price.toFixed(2)})` : ' (Free)';
        price.dataset.price = addon.price;
        
        label.appendChild(price);
        ingredientDiv.appendChild(checkbox);
        ingredientDiv.appendChild(label);
        updatedAddOnsContainer.appendChild(ingredientDiv);
    });
    
    // Make sure add button picks up add-ons from the unified section
    const addCustomizedBtn = document.getElementById('add-customized');
    if (addCustomizedBtn) {
        addCustomizedBtn.onclick = function() {
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
            
            addToCartWithCustomization(currentItem.id, removedIngredients, addedIngredients);
            
            customizeModal.style.display = 'none';
        };
    }
    
    // Show the modal
    customizeModal.style.display = 'block';
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
            
            showNotification('Customized item added to cart!');
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
    
    if (Object.keys(cartItems).length === 0) {
        cartItemsDiv.innerHTML = '<p>Your cart is empty.</p>';
        cartTotalPrice.textContent = '$0.00';
        return;
    }
    
    const ul = document.createElement('ul');
    
    for (const [itemId, item] of Object.entries(cartItems)) {
        const li = document.createElement('li');
        li.dataset.itemId = itemId;
        
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
                removeFromCart(itemId);
            });
            
            const decreaseBtn = document.createElement('button');
            decreaseBtn.className = 'decrease-qty-btn';
            decreaseBtn.innerHTML = '<i class="fas fa-minus"></i>';
            decreaseBtn.title = 'Decrease quantity';
            decreaseBtn.addEventListener('click', function() {
                removeFromCart(itemId, true);
            });
            
            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'item-actions';
            actionsContainer.appendChild(decreaseBtn);
            actionsContainer.appendChild(removeBtn);
            
            li.appendChild(nameSpan);
            li.appendChild(quantitySpan);
            li.appendChild(priceSpan);
            li.appendChild(comboComponentsList);
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
                removeFromCart(itemId);
            });
            
            const decreaseBtn = document.createElement('button');
            decreaseBtn.className = 'decrease-qty-btn';
            decreaseBtn.innerHTML = '<i class="fas fa-minus"></i>';
            decreaseBtn.title = 'Decrease quantity';
            decreaseBtn.addEventListener('click', function() {
                removeFromCart(itemId, true);
            });
            
            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'item-actions';
            actionsContainer.appendChild(decreaseBtn);
            actionsContainer.appendChild(removeBtn);
            
            li.appendChild(nameSpan);
            li.appendChild(quantitySpan);
            li.appendChild(priceSpan);
            li.appendChild(actionsContainer);
        }
        
        ul.appendChild(li);
    }
    
    cartItemsDiv.appendChild(ul);
    cartTotalPrice.textContent = '$' + cartTotal.toFixed(2);
}

function removeFromCart(itemId, decreaseOnly = false) {
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
        top: 20px;
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
            messagePara.textContent = "Welcome to McDonald's! How can I help you today?";
            
            messageDiv.appendChild(messagePara);
            chatMessages.appendChild(messageDiv);
        }
    }, 500);
});