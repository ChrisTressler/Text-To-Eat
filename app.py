from flask import Flask, render_template, request, jsonify, session, redirect, url_for
import os
import time
from datetime import datetime
import json
import sys
from openai import OpenAI

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from menu import Menu, MenuItem
from shopping_cart import ShoppingCart

client = OpenAI()

app = Flask(__name__)
app.secret_key = 'fastfoodkiosk_secretkey'

class CustomMenu(Menu):
    def load_menu(self, filename: str):
        with open(filename, 'r', encoding='utf-8') as file:
            data = json.load(file)

        for item in data['menuItems']:
            menu_item = MenuItem(
                name=item['name'],
                id=item['id'],
                price=item['price'],
                ingredients=item['ingredients'],
                combo=item['combo'],
                size=item['size'],
                category=item['category'],
                description=item['description']
            )
            self.items[item['id']] = menu_item

        for item in self.items.values():
            resolved_ingredients = []
            for ing_id in item.ingredients:
                if ing_id in self.items:
                    resolved_ingredients.append(self.items[ing_id])
                else:
                    print(f"Warning: Ingredient {ing_id} not found for item {item.id}")
            
            item.ingredients = resolved_ingredients

    def serialize_item(self, item):
        if not item:
            return None
        
        serialized = {
            'id': item.id,
            'name': item.name,
            'price': item.price,
            'description': item.description,
            'category': item.category,
            'combo': item.combo,
            'size': item.size
        }
        
        if hasattr(item, 'ingredients') and item.ingredients:
            serialized['ingredients'] = []
            for ing in item.ingredients:
                serialized['ingredients'].append({
                    'id': ing.id,
                    'name': ing.name,
                    'price': ing.price
                })
        else:
            serialized['ingredients'] = []
        
        available_extras = self.get_available_extras(item)
        if available_extras:
            serialized['available_extras'] = available_extras
        
        return serialized
    
    def get_available_extras(self, item):
        extras = []
        extra_categories = ['toppings', 'condiments']
        
        for potential_extra in self.get_items():
            if potential_extra.category in extra_categories:
                is_already_ingredient = False
                if hasattr(item, 'ingredients'):
                    for ing in item.ingredients:
                        if potential_extra.id == ing.id:
                            is_already_ingredient = True
                            break
                
                if not is_already_ingredient:
                    extras.append({
                        'id': potential_extra.id,
                        'name': potential_extra.name,
                        'price': potential_extra.price
                    })
        
        return extras

    def find_item_by_name(self, name, fuzzy=False):
        if not name:
            return None
            
        name_lower = name.lower().strip()
        
        for item in self.items.values():
            if item.name.lower() == name_lower:
                return item
        
        direct_matches = {
            "coke": "DRINK001",
            "coca-cola": "DRINK001",
            "coca cola": "DRINK001",
            "diet coke": "DRINK002",
            "sprite": "DRINK003",
            "sweet tea": "DRINK004",
            "iced tea": "DRINK005",
            "unsweetened tea": "DRINK005",
            "orange juice": "DRINK006",
            "milk": "DRINK007",
            "chocolate milk": "DRINK008",
            "water": "DRINK009",
            "dasani": "DRINK009",
            
            "big mac": "BURG001",
            "quarter pounder": "BURG002",
            "double quarter pounder": "BURG003",
            "cheeseburger": "BURG004",
            "double cheeseburger": "BURG005",
            "hamburger": "BURG006",
            "mcdouble": "BURG007",
            
            "mcchicken": "CHICK001",
            "spicy mcchicken": "CHICK002",
            "crispy chicken": "CHICK003",
            "spicy crispy chicken": "CHICK004",
            "deluxe crispy chicken": "CHICK005",
            
            "filet-o-fish": "FISH001",
            "fish sandwich": "FISH001",
            "fish filet": "FISH001",
            
            "4 piece nuggets": "NUG001",
            "4 nuggets": "NUG001",
            "4pc nuggets": "NUG001",
            "6 piece nuggets": "NUG002",
            "6 nuggets": "NUG002",
            "6pc nuggets": "NUG002",
            "10 piece nuggets": "NUG003",
            "10 nuggets": "NUG003",
            "10pc nuggets": "NUG003",
            "20 piece nuggets": "NUG004",
            "20 nuggets": "NUG004",
            "20pc nuggets": "NUG004",
            "40 piece nuggets": "NUG005",
            "40 nuggets": "NUG005",
            "40pc nuggets": "NUG005",
            "6 spicy nuggets": "NUG006",
            "6pc spicy nuggets": "NUG006",
            "10 spicy nuggets": "NUG007",
            "10pc spicy nuggets": "NUG007",
            
            "small fries": "SIDE001",
            "medium fries": "SIDE002",
            "large fries": "SIDE003",
            "fries": "SIDE002",
            
            "apple pie": "DESSERT001",
            "muffin": "DESSERT002", 
            "blueberry muffin": "DESSERT002",
            "cinnamon roll": "DESSERT003",
            "cookie": "DESSERT004",
            "chocolate chip cookie": "DESSERT004",
            "oreo mcflurry": "DESSERT005",
            "m&m mcflurry": "DESSERT006",
            "vanilla cone": "DESSERT007",
            "ice cream cone": "DESSERT007",
            "hot fudge sundae": "DESSERT008",
            "caramel sundae": "DESSERT009",
        }
        
        for pattern, item_id in direct_matches.items():
            if name_lower == pattern:
                return self.get_item_information(item_id)
            if pattern in name_lower:
                potential_item = self.get_item_information(item_id)
                if potential_item and potential_item.name.lower() in name_lower:
                    return potential_item
        
        if fuzzy:
            best_match = None
            best_match_score = 0
            
            for item in self.items.values():
                item_name_lower = item.name.lower()
                
                if item.category in ['ingredients', 'toppings', 'patties', 'condiments']:
                    continue
                    
                if name_lower in item_name_lower:
                    score = len(name_lower) / len(item_name_lower) * 100
                    if score > best_match_score:
                        best_match = item
                        best_match_score = score
                elif item_name_lower in name_lower:
                    score = len(item_name_lower) / len(name_lower) * 100
                    if score > best_match_score:
                        best_match = item
                        best_match_score = score
            
            if best_match_score > 60:
                return best_match
        
        sizes = ["small", "medium", "large"]
        for size in sizes:
            if size in name_lower:
                size_stripped = name_lower.replace(size, "").strip()
                for item in self.items.values():
                    if size_stripped in item.name.lower() and item.size.lower() == size:
                        return item
        
        return None
        
    def find_items_by_category(self, category):
        matching_items = []
        category_lower = category.lower()
        for item in self.items.values():
            if item.category.lower() == category_lower:
                matching_items.append(item)
        return matching_items

class CustomizedMenuItem:
    def __init__(self, base_item, removed_ingredients=None, added_ingredients=None):
        self.base_item = base_item
        self.removed_ingredients = removed_ingredients or []
        self.added_ingredients = added_ingredients or []
        self.id = f"{base_item.id}-custom-{datetime.now().timestamp()}"
        
        self.price = base_item.price
        
        for ing_id in self.added_ingredients:
            ing = menu.get_item_information(ing_id)
            if ing:
                self.price += ing.price
        
        self.name = f"{base_item.name} (Customized)"
        
        self.category = base_item.category
        self.size = base_item.size
        self.combo = base_item.combo
        self.description = base_item.description

menu = CustomMenu()

try:
    menu.load_menu("menu_data.json")
    print(f"Menu loaded successfully with {len(menu.items)} items")
except Exception as e:
    print(f"Error loading menu: {e}")

@app.route('/')
def start_page():
    session.clear()
    return render_template('index.html')

@app.route('/menu')
def menu_page():
    if 'start_time' not in session:
        session['start_time'] = time.time()
        
    if 'cart_id' not in session:
        cart_id = str(datetime.now().timestamp())
        session['cart_id'] = cart_id
        session['cart_items'] = {}
        session['cart_total'] = 0.0
        
    excluded_categories = ['ingredients', 'toppings', 'condiments']
    
    menu_items = menu.get_items()
    display_items = [item for item in menu_items if item.category not in excluded_categories]
    
    categories = []
    for item in display_items:
        if item.category not in categories and item.category not in excluded_categories:
            categories.append(item.category)
    
    category_order = ['burgers', 'sides', 'drinks', 'desserts', 'breakfast']
    categories.sort(key=lambda x: category_order.index(x) if x in category_order else 999)
    
    return render_template('menu.html', 
                          categories=categories, 
                          menu_items=display_items)

@app.route('/checkout')
def checkout_page():
    elapsed_time = 0
    if 'start_time' in session:
        elapsed_time = time.time() - session['start_time']
        
    minutes = int(elapsed_time // 60)
    seconds = int(elapsed_time % 60)
    time_display = f"{minutes}m {seconds}s"
    
    cart_items = session.get('cart_items', {})
    cart_total = session.get('cart_total', 0.0)
    
    return render_template('checkout.html', 
                          time_display=time_display,
                          cart_items=cart_items,
                          cart_total=cart_total)

@app.route('/api/add_to_cart', methods=['POST'])
def add_to_cart():
    item_id = request.json.get('item_id')
    
    item = menu.get_item_information(item_id)
    if not item:
        return jsonify({"success": False, "message": "Item not found"})
    
    cart_items = session.get('cart_items', {})
    
    item_dict = {
        'id': item.id,
        'name': item.name,
        'price': item.price,
        'quantity': cart_items.get(item.id, {}).get('quantity', 0) + 1
    }
    
    cart_items[item.id] = item_dict
    session['cart_items'] = cart_items
    
    session['cart_total'] = session.get('cart_total', 0.0) + item.price
    
    session.modified = True
    
    return jsonify({"success": True, "cart": cart_items, "total": session['cart_total']})

@app.route('/api/clear_cart', methods=['POST'])
def clear_cart():
    session['cart_items'] = {}
    session['cart_total'] = 0.0
    session.modified = True
    
    return jsonify({
        "success": True,
        "message": "Cart cleared successfully"
    })

@app.route('/api/get_cart', methods=['GET'])
def get_cart():
    cart_items = session.get('cart_items', {})
    cart_total = session.get('cart_total', 0.0)
    
    return jsonify({
        "success": True,
        "cart": cart_items,
        "total": cart_total
    })

@app.route('/api/get_item_details', methods=['POST'])
def get_item_details():
    item_id = request.json.get('item_id')
    
    item = menu.get_item_information(item_id)
    if not item:
        return jsonify({"success": False, "message": "Item not found"})
    
    serialized_item = menu.serialize_item(item)
    
    return jsonify({"success": True, "item": serialized_item})

@app.route('/api/add_customized_item', methods=['POST'])
def add_customized_item():
    item_id = request.json.get('item_id')
    removed_ingredients = request.json.get('removed_ingredients', [])
    added_ingredients = request.json.get('added_ingredients', [])
    
    base_item = menu.get_item_information(item_id)
    if not base_item:
        return jsonify({"success": False, "message": "Base item not found"})
    
    custom_item = CustomizedMenuItem(base_item, removed_ingredients, added_ingredients)
    
    cart_items = session.get('cart_items', {})
    
    item_dict = {
        'id': custom_item.id,
        'name': custom_item.name,
        'price': custom_item.price,
        'quantity': 1,
        'customizations': {
            'removed': removed_ingredients,
            'added': added_ingredients
        }
    }
    
    cart_items[custom_item.id] = item_dict
    session['cart_items'] = cart_items
    
    session['cart_total'] = session.get('cart_total', 0.0) + custom_item.price
    session.modified = True
    
    return jsonify({"success": True, "cart": cart_items, "total": session['cart_total']})

@app.route('/api/chat', methods=['POST'])
def chat():
    user_message = request.json.get('message', '')
    current_order = request.json.get('currentOrder', {"menuItems": [], "total": 0.0})
    conversation_history = request.json.get('conversationHistory', [])
    
    if "items" in current_order and "menuItems" not in current_order:
        current_order = {"menuItems": current_order["items"], "total": current_order.get("total", 0.0)}
    
    pending_item_key = 'pending_combo_item'
    pending_item = session.get(pending_item_key, None)
    
    system_message = f"""You are a helpful fast food restaurant assistant.
    You help customers place orders and understand the menu.
    Here's a list of menu categories: burgers, sides, drinks, desserts, chicken, fish, breakfast, mccafe, Happy Meal, salads.
    
    IMPORTANT: When identifying items, be VERY specific and use exact names:
    - For "coke" or "coca-cola", use "Coca-Cola" (not Diet Coke)
    - For nuggets, specify the exact size (4pc, 6pc, 10pc, 20pc, or 40pc) and whether they're regular or spicy
    - For fries, specify the size (Small, Medium, or Large) - default to Medium if not specified
    - For specialty items, use the full name (e.g., "McFlurry with OREO Cookies" not just "McFlurry")
    
    COMBO MEAL HANDLING INSTRUCTIONS:
    - When a customer orders a combo-eligible item, ask if they want to make it a combo
    - DO NOT add the item to cart yet - set ORDER_TYPE to "potential_combo" and ACTION to "collect_more_info"
    - If they say yes to a combo, ask which drink they want (default to Coca-Cola if unspecified)
    - Only after confirming the drink choice, create the combo meal
    - Combo meals always include Medium Fries and the selected drink
    
    CART MODIFICATION INSTRUCTIONS:
    - When a customer asks to remove something, set ORDER_TYPE to "remove_item"
    - When asked to clear the cart, set ORDER_TYPE to "clear_cart" 
    - Be specific when identifying items to remove
    - For removal requests, respond with a clear confirmation of what was removed
    
    Your response format should be:
    ORDER_TYPE: [single_item, potential_combo, combo_meal, combo_drink_selection, remove_item, clear_cart, checkout, general_query]
    MAIN_ITEM: [specific item name or "none"]
    DRINK: [specific drink name or "none"]
    CUSTOMIZATIONS: [comma-separated list of customizations or "none"]
    ACTION: [add_to_cart, collect_more_info, remove_from_cart, clear_cart, checkout, respond_only]
    MESSAGE: [Your conversational response to the customer]
    
    Examples:
    For "I'd like a Big Mac" → "ORDER_TYPE: potential_combo\nMAIN_ITEM: Big Mac\nDRINK: none\nCUSTOMIZATIONS: none\nACTION: collect_more_info\nMESSAGE: Would you like to make that a Big Mac Combo with fries and a drink?"
    
    For "Yes, with a Sprite" → "ORDER_TYPE: combo_meal\nMAIN_ITEM: Big Mac\nDRINK: Sprite\nCUSTOMIZATIONS: none\nACTION: add_to_cart\nMESSAGE: Great! I've added a Big Mac Combo with Medium Fries and Sprite to your cart."
    
    For "I'll just have the sandwich by itself" → "ORDER_TYPE: single_item\nMAIN_ITEM: Big Mac\nDRINK: none\nCUSTOMIZATIONS: none\nACTION: add_to_cart\nMESSAGE: I've added a Big Mac to your cart."
    """
    
    try:
        messages = [{"role": "system", "content": system_message}]
        
        for msg in conversation_history:
            role = "assistant" if msg.get("isBot", False) else "user"
            messages.append({"role": role, "content": msg.get("message", "")})
            
        messages.append({"role": "user", "content": user_message})
        
        completion = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
        )
        
        assistant_response = completion.choices[0].message.content
        
        order_type = None
        main_item = None
        drink_item = None
        customizations = []
        action = None
        message_to_user = assistant_response
        
        try:
            order_type = assistant_response.split("ORDER_TYPE:")[1].split("\n")[0].strip().lower()
            main_item_section = assistant_response.split("MAIN_ITEM:")[1].split("\n")[0].strip()
            drink_section = assistant_response.split("DRINK:")[1].split("\n")[0].strip()
            customization_section = assistant_response.split("CUSTOMIZATIONS:")[1].split("\n")[0].strip()
            action = assistant_response.split("ACTION:")[1].split("\n")[0].strip().lower()
            message_section = assistant_response.split("MESSAGE:")[1].strip()
            
            message_to_user = message_section
            
            if main_item_section.lower() != "none":
                main_item = menu.find_item_by_name(main_item_section)
                if not main_item:
                    main_item = menu.find_item_by_name(main_item_section, fuzzy=True)
            
            if drink_section.lower() != "none":
                drink_item = menu.find_item_by_name(drink_section)
                if not drink_item:
                    drink_item = menu.find_item_by_name(drink_section, fuzzy=True)
            
            if customization_section.lower() != "none":
                customizations = [custom.strip() for custom in customization_section.split(",")]
        
        except Exception as e:
            print(f"Error parsing LLM response: {e}")
            order_type = "general_query"
            action = "respond_only"
            message_to_user = assistant_response
        
        items_to_add = []
        removed_items = []
        
        if order_type == "potential_combo" and action == "collect_more_info" and main_item:
            session[pending_item_key] = {
                'id': main_item.id,
                'name': main_item.name,
                'customizations': customizations
            }
            session.modified = True
        
        elif order_type == "combo_meal" and action == "add_to_cart":
            combo_main_item = None
            
            if main_item and main_item.combo:
                combo_main_item = main_item
            elif pending_item:
                combo_main_item = menu.get_item_information(pending_item.get('id'))
                customizations = pending_item.get('customizations', [])
            
            if combo_main_item:
                fries = menu.find_item_by_name("World Famous Fries (Medium)")
                
                if not drink_item:
                    drink_item = menu.find_item_by_name("Coca-Cola")
                
                if fries and drink_item:
                    combo_id = f"COMBO-{combo_main_item.id}-{datetime.now().timestamp()}"
                    cart_items = session.get('cart_items', {})
                    
                    base_combo_upcharge = 2.99
                    combo_price = combo_main_item.price + base_combo_upcharge
                    has_premium_drink = drink_item.price > 1.99
                    
                    if has_premium_drink:
                        drink_upcharge = drink_item.price - 1.99
                        combo_price += drink_upcharge
                    
                    combo_components = [
                        {"id": combo_main_item.id, "name": combo_main_item.name, "is_premium": False},
                        {"id": fries.id, "name": fries.name, "is_premium": False},
                        {"id": drink_item.id, "name": drink_item.name, "is_premium": has_premium_drink}
                    ]
                    
                    combo_item = {
                        'id': combo_id,
                        'name': f"{combo_main_item.name} Combo",
                        'price': combo_price,
                        'quantity': 1,
                        'is_combo': True,
                        'combo_items': combo_components,
                        'has_premium_drink': has_premium_drink,
                        'premium_info': "Premium drink" if has_premium_drink else ""
                    }
                    
                    if customizations:
                        removed_ingredients = []
                        added_ingredients = []
                        
                        for custom in customizations:
                            custom = custom.lower()
                            if custom.startswith("no "):
                                ingredient_name = custom[3:].strip()
                                for ing in combo_main_item.ingredients:
                                    if ingredient_name in ing.name.lower():
                                        removed_ingredients.append(ing.id)
                            elif custom.startswith("extra "):
                                ingredient_name = custom[6:].strip()
                                for potential_extra in menu.get_items():
                                    if (potential_extra.category in ['toppings', 'condiments'] and 
                                        ingredient_name in potential_extra.name.lower()):
                                        added_ingredients.append(potential_extra.id)
                        
                        if removed_ingredients or added_ingredients:
                            combo_item['customizations'] = {
                                'removed': removed_ingredients,
                                'added': added_ingredients
                            }
                    
                    cart_items[combo_id] = combo_item
                    session['cart_items'] = cart_items
                    session['cart_total'] = session.get('cart_total', 0.0) + combo_price
                    session.modified = True
                    
                    items_to_add.append(combo_main_item)
                    
                    session.pop(pending_item_key, None)
                    session.modified = True
        
        elif order_type == "single_item" and action == "add_to_cart":
            target_item = None
            
            if main_item:
                target_item = main_item
            elif pending_item:
                target_item = menu.get_item_information(pending_item.get('id'))
                customizations = pending_item.get('customizations', [])
            
            if target_item:
                if customizations:
                    removed_ingredients = []
                    added_ingredients = []
                    
                    for custom in customizations:
                        custom = custom.lower()
                        if custom.startswith("no "):
                            ingredient_name = custom[3:].strip()
                            for ing in target_item.ingredients:
                                if ingredient_name in ing.name.lower():
                                    removed_ingredients.append(ing.id)
                        elif custom.startswith("extra "):
                            ingredient_name = custom[6:].strip()
                            for potential_extra in menu.get_items():
                                if (potential_extra.category in ['toppings', 'condiments'] and 
                                    ingredient_name in potential_extra.name.lower()):
                                    added_ingredients.append(potential_extra.id)
                    
                    custom_item = CustomizedMenuItem(target_item, removed_ingredients, added_ingredients)
                    
                    cart_items = session.get('cart_items', {})
                    
                    item_dict = {
                        'id': custom_item.id,
                        'name': custom_item.name,
                        'price': custom_item.price,
                        'quantity': 1,
                        'customizations': {
                            'removed': removed_ingredients,
                            'added': added_ingredients
                        }
                    }
                    
                    cart_items[custom_item.id] = item_dict
                    session['cart_items'] = cart_items
                    
                    session['cart_total'] = session.get('cart_total', 0.0) + custom_item.price
                    session.modified = True
                else:
                    cart_items = session.get('cart_items', {})
                    
                    if target_item.id in cart_items:
                        cart_items[target_item.id]['quantity'] += 1
                    else:
                        cart_items[target_item.id] = {
                            'id': target_item.id,
                            'name': target_item.name,
                            'price': target_item.price,
                            'quantity': 1
                        }
                    
                    session['cart_items'] = cart_items
                    session['cart_total'] = session.get('cart_total', 0.0) + target_item.price
                    session.modified = True
                
                items_to_add.append(target_item)
                
                session.pop(pending_item_key, None)
                session.modified = True
        
        elif order_type == "remove_item" or action == "remove_from_cart":
            item_to_remove = main_item_section if main_item_section.lower() != "none" else ""
            
            if not item_to_remove and ("all" in user_message.lower() or "everything" in user_message.lower()):
                for item_id, item_data in list(session.get('cart_items', {}).items()):
                    removed_items.append(item_data['name'])
                session['cart_items'] = {}
                session['cart_total'] = 0.0
                session.modified = True
            else:
                for item_id, item_data in list(session.get('cart_items', {}).items()):
                    if (item_to_remove.lower() in item_data['name'].lower() or 
                        (main_item and main_item.name.lower() in item_data['name'].lower())):
                        removed_items.append(item_data['name'])
                        session['cart_total'] = max(0, session.get('cart_total', 0.0) - (item_data['price'] * item_data['quantity']))
                        session['cart_items'].pop(item_id)
                        session.modified = True
                        break
            
            session.pop(pending_item_key, None)
            session.modified = True
        
        elif order_type == "clear_cart" or action == "clear_cart":
            for item_id, item_data in list(session.get('cart_items', {}).items()):
                removed_items.append(item_data['name'])
            session['cart_items'] = {}
            session['cart_total'] = 0.0
            session.modified = True
            
            session.pop(pending_item_key, None)
            session.modified = True
        
        action_response = None
        if "checkout" in user_message.lower() or "pay" in user_message.lower() or order_type == "checkout":
            action_response = "checkout"
            message_to_user = "Great! Taking you to checkout now."
            
            session.pop(pending_item_key, None)
            session.modified = True
        
        cart_items = session.get('cart_items', {})
        updated_order = {
            "menuItems": [],
            "total": session.get('cart_total', 0.0)
        }
        
        for item_id, item_data in cart_items.items():
            updated_order["menuItems"].append({
                "id": item_data['id'],
                "name": item_data['name'],
                "price": item_data['price'],
                "quantity": item_data['quantity']
            })
        
        return jsonify({
            "response": message_to_user,
            "order": updated_order,
            "items": [menu.serialize_item(item) for item in items_to_add if item],
            "removed_items": removed_items,
            "action": action_response,
            "pendingCombo": pending_item is not None
        })
        
    except Exception as e:
        print(f"Error in chat API: {str(e)}")
        return jsonify({
            "response": "I apologize, but I encountered an error. Please try again.",
            "order": current_order,
            "action": None
        }), 500

@app.route('/api/remove_from_cart', methods=['POST'])
def remove_from_cart():
    try:
        item_id = request.json.get('item_id')
        decrease_only = request.json.get('decrease_only', False)
        
        if not item_id:
            return jsonify({
                'success': False,
                'message': 'Item ID is required'
            }), 400
        
        cart_items = session.get('cart_items', {})
        
        if item_id not in cart_items:
            return jsonify({
                'success': False,
                'message': 'Item not found in cart'
            }), 404
        
        removed_items = []
        
        if decrease_only and cart_items[item_id]['quantity'] > 1:
            cart_items[item_id]['quantity'] -= 1
            removed_items.append({'id': item_id, 'quantity': 1})
            session['cart_total'] -= cart_items[item_id]['price']
        else:
            removed_quantity = cart_items[item_id]['quantity']
            removed_items.append({'id': item_id, 'quantity': removed_quantity})
            session['cart_total'] -= cart_items[item_id]['price'] * removed_quantity
            del cart_items[item_id]
        
        session['cart_items'] = cart_items
        session.modified = True
        
        return jsonify({
            'success': True,
            'cart': cart_items,
            'total': session['cart_total'],
            'removed_items': removed_items
        })
        
    except Exception as e:
        print(f"Error in remove_from_cart: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Error removing item from cart: {str(e)}'
        }), 500

@app.route('/api/get_category_items', methods=['POST'])
def get_category_items():
    category = request.json.get('category')
    if not category:
        return jsonify({'success': False, 'message': 'Category is required'})
    
    items = menu.find_items_by_category(category)
    serialized_items = [menu.serialize_item(item) for item in items]
    
    return jsonify({
        'success': True,
        'items': serialized_items
    })

@app.route('/api/add_combo_to_cart', methods=['POST'])
def add_combo_to_cart():
    base_item_id = request.json.get('base_item_id')
    fries_item_id = request.json.get('fries_item_id') 
    drink_item_id = request.json.get('drink_item_id')
    combo_price = request.json.get('combo_price')
    
    if not all([base_item_id, fries_item_id, drink_item_id, combo_price]):
        return jsonify({"success": False, "message": "Missing required combo information"})
    
    base_item = menu.get_item_information(base_item_id)
    fries_item = menu.get_item_information(fries_item_id)
    drink_item = menu.get_item_information(drink_item_id)
    
    if not all([base_item, fries_item, drink_item]):
        return jsonify({"success": False, "message": "One or more combo items not found"})
    
    combo_id = f"COMBO-{base_item.id}-{datetime.now().timestamp()}"
    
    cart_items = session.get('cart_items', {})
    
    combo_components = [
        {"id": base_item.id, "name": base_item.name, "is_premium": False},
        {"id": fries_item.id, "name": fries_item.name, "is_premium": False},
        {"id": drink_item.id, "name": drink_item.name, "is_premium": drink_item.price > 1.99}
    ]
    
    premium_info = ""
    has_premium_drink = drink_item.price > 1.99
    
    if has_premium_drink:
        premium_info = "Premium drink"
    
    combo_item = {
        'id': combo_id,
        'name': f"{base_item.name} Combo",
        'price': float(combo_price),
        'quantity': 1,
        'is_combo': True,
        'combo_items': combo_components,
        'has_premium_drink': has_premium_drink,
        'premium_info': premium_info
    }
    
    cart_items[combo_id] = combo_item
    session['cart_items'] = cart_items
    
    session['cart_total'] = session.get('cart_total', 0.0) + float(combo_price)
    session.modified = True
    
    return jsonify({"success": True, "cart": cart_items, "total": session['cart_total']})

if __name__ == '__main__':
    app.run(debug=True)