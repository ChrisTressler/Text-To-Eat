from flask import Flask, render_template, request, jsonify, session, redirect, url_for
import os
import time
from datetime import datetime
import json
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from menu import Menu, MenuItem
from shopping_cart import ShoppingCart
from new_agent import client, load_current_order, save_order, initialize_new_order, process_order_request

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
                combo=False,
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
                # Special case for cheese - always include it as an option
                if potential_extra.id == "TOPPING004":  # Cheese ID
                    extras.append({
                        'id': potential_extra.id,
                        'name': "Extra " + potential_extra.name,
                        'price': potential_extra.price
                    })
                    continue
                
                # Normal logic for other toppings
                
                is_already_ingredient = False
                """
                if hasattr(item, 'ingredients'):
                    for ing in item.ingredients:
                        if potential_extra.id == ing.id:
                            is_already_ingredient = True
                            break
                            """
                
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
        self.combo = False
        self.description = base_item.description

menu = CustomMenu()

try:
    menu.load_menu("menu_data.json")
except Exception as e:
    print(f"Error loading menu: {e}")

@app.route('/')
def start_page():
    session.clear()
    # Initialize a new empty order
    initialize_new_order()
    return render_template('index.html')

@app.route('/menu')
def menu_page():
    if 'start_time' not in session:
        session['start_time'] = time.time()
        
    # Ensure we have a valid order file
    if not os.path.exists('order.json'):
        initialize_new_order()
        
    excluded_categories = ['ingredients', 'toppings', 'condiments']
    
    menu_items = menu.get_items()
    
    # Group items with the same base ID
    grouped_items = {}
    
    for item in menu_items:
        if item.category in excluded_categories:
            continue
            
        # Extract base ID (everything before the dash if it exists)
        base_id = item.id.split('-')[0] if '-' in item.id else item.id
        
        # Create or get the group for this base ID
        if base_id not in grouped_items:
            # Initialize with the first item found with this base ID
            grouped_items[base_id] = {
                'id': base_id,
                'name': item.name.split(' (')[0] if ' (' in item.name else item.name,  # Remove size from name
                'description': item.description,
                'category': item.category,
                'combo': item.combo,
                'sizes': [],
                'has_multiple_sizes': False,
                'base_price': item.price  # Default to the first found item's price
            }
        
        # Add this item as a size option
        if '-' in item.id:
            size_code = item.id.split('-')[1]
            size_name = item.size
            
            # Map size codes to full names if needed
            # Check if this is a piece-count item like McNuggets or Mozzarella Sticks
            is_piece_count_item = 'NUG' in base_id or 'SIDE006' in base_id  # McNuggets or Mozzarella Sticks
            
            if is_piece_count_item:
                # Extract piece count from the name
                pc_count = ""
                if "(" in item.name and ")" in item.name:
                    pc_info = item.name.split("(")[1].split(")")[0]
                    if "pc" in pc_info.lower():
                        pc_count = pc_info
                    else:
                        pc_count = size_name.capitalize()
                else:
                    pc_count = size_name.capitalize()
                size_display = pc_count
            else:
                size_display = {
                    's': 'Small', 
                    'm': 'Medium', 
                    'l': 'Large',
                    'xl': 'Extra Large'
                }.get(size_code, size_name)
            
            grouped_items[base_id]['sizes'].append({
                'id': item.id,
                'size_code': size_code,
                'size_name': size_display,
                'price': item.price,
                'name': item.name
            })
            grouped_items[base_id]['has_multiple_sizes'] = True
    
    # Sort sizes within each group (s, m, l, xl)
    size_order = {'s': 0, 'm': 1, 'l': 2, 'xl': 3}
    for item in grouped_items.values():
        if item['sizes']:
            item['sizes'].sort(key=lambda x: size_order.get(x['size_code'], 99))
            # Set the default price to the medium size if available, otherwise the first size
            medium_size = next((s for s in item['sizes'] if s['size_code'] == 'm'), None)
            if medium_size:
                item['base_price'] = medium_size['price']
            elif item['sizes']:
                item['base_price'] = item['sizes'][0]['price']
    
    # Convert dictionary to list for the template
    display_items = list(grouped_items.values())
    
    categories = []
    for item in display_items:
        if item['category'] not in categories and item['category'] not in excluded_categories:
            categories.append(item['category'])
    
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
    
    # Load current order from order.json
    current_order = load_current_order()
    
    return render_template('checkout.html', 
                          time_display=time_display,
                          cart_items=current_order.get("menuItems", []),
                          cart_total=current_order.get("total", 0.0))

@app.route('/api/add_to_cart', methods=['POST'])
def add_to_cart():
    item_id = request.json.get('item_id')
    
    item = menu.get_item_information(item_id)
    if not item:
        return jsonify({"success": False, "message": "Item not found"})
    
    # Load current order from order.json
    current_order = load_current_order()
    
    # Prepare the order structure if needed
    if "menuItems" not in current_order:
        current_order["menuItems"] = []
    
    # Check if item already exists in order
    item_exists = False
    for order_item in current_order["menuItems"]:
        if order_item["id"] == item_id:
            order_item["quantity"] += 1
            item_exists = True
            break
    
    # If item doesn't exist, add it
    if not item_exists:
        current_order["menuItems"].append({
            "id": item_id,
            "name": item.name,
            "price": item.price,
            "quantity": 1
        })
    
    # Calculate the new total
    current_order["total"] = sum(item["price"] * item["quantity"] for item in current_order["menuItems"])
    
    # Save the updated order
    save_order(current_order, menu.get_items())
    
    # Check if we should suggest sides/drinks or sauces
    suggestion = None
    suggestion_type = None
    
        # For fries, nuggets, and salads, suggest sauces
    if item.category == "sides" or "nug" in item.id.lower() or item.category == "salads":
        suggestion_type = "sauce"
        suggestion = {
            "message": "Would you like any sauce with that?",
            "type": "sauce",
            "item_id": item_id
        }
    # For burgers and sandwiches (entrees), suggest sides and drinks
    elif item.category in ['burgers', 'chicken', 'fish']:
        suggestion_type = "entree"
        suggestion = {
            "message": "Would you like to add a side or drink to your order?",
            "type": "entree",
            "item_id": item_id
        }
    
    return jsonify({
        "success": True, 
        "cart": current_order["menuItems"], 
        "total": current_order["total"],
        "suggestion": suggestion,
        "suggestion_type": suggestion_type
    })

@app.route('/api/clear_cart', methods=['POST'])
def clear_cart():
    # Create an empty order and save it
    empty_order = {"menuItems": [], "total": 0.0}
    save_order(empty_order)
    
    return jsonify({
        "success": True,
        "message": "Cart cleared successfully"
    })

@app.route('/api/get_cart', methods=['GET'])
def get_cart():
    # Load current order from order.json
    current_order = load_current_order()
    
    return jsonify({
        "success": True,
        "cart": current_order.get("menuItems", []),
        "total": current_order.get("total", 0.0)
    })

@app.route('/api/get_item_details', methods=['POST'])
def get_item_details():
    item_id = request.json.get('item_id')
    
    # Check if this is a size-specific ID (contains a dash)
    base_id = item_id.split('-')[0] if '-' in item_id else item_id
    size_code = item_id.split('-')[1] if '-' in item_id else None
    
    item = menu.get_item_information(item_id)
    if not item:
        return jsonify({"success": False, "message": "Item not found"})
    
    serialized_item = menu.serialize_item(item)
    
    # If this is a size variation, also include information about other sizes
    if size_code:
        sizes = []
        # Look for other size variations of this item
        for menu_item in menu.get_items():
            if '-' in menu_item.id and menu_item.id.split('-')[0] == base_id:
                item_size_code = menu_item.id.split('-')[1]
                
                # Check if this is a piece-count item
                is_piece_count_item = 'NUG' in base_id or 'SIDE006' in base_id  # McNuggets or Mozzarella Sticks
                
                if is_piece_count_item:
                    # Extract piece count from the name
                    pc_count = ""
                    if "(" in menu_item.name and ")" in menu_item.name:
                        pc_info = menu_item.name.split("(")[1].split(")")[0]
                        if "pc" in pc_info.lower():
                            pc_count = pc_info
                        else:
                            pc_count = menu_item.size.capitalize()
                    else:
                        pc_count = menu_item.size.capitalize()
                    size_display = pc_count
                else:
                    size_display = {
                        's': 'Small', 
                        'm': 'Medium', 
                        'l': 'Large',
                        'xl': 'Extra Large'
                    }.get(item_size_code, menu_item.size)
                
                sizes.append({
                    'id': menu_item.id,
                    'size_code': item_size_code,
                    'size_name': size_display,
                    'price': menu_item.price
                })
        
        # Sort sizes
        size_order = {'s': 0, 'm': 1, 'l': 2, 'xl': 3}
        sizes.sort(key=lambda x: size_order.get(x['size_code'], 99))
        
        serialized_item['available_sizes'] = sizes
        serialized_item['is_size_variant'] = True
        serialized_item['base_id'] = base_id
    
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
    
    # Load current order from order.json
    current_order = load_current_order()
    
    # Prepare the order structure if needed
    if "menuItems" not in current_order:
        current_order["menuItems"] = []
    
    # Create the customized item entry
    customization_notes = []
    
    # Add size information if this is a size variation
    if '-' in item_id:
        base_id = item_id.split('-')[0]
        size_code = item_id.split('-')[1]
        
        # Check if this is a piece-count item
        is_piece_count_item = 'NUG' in base_id or 'SIDE006' in base_id  # McNuggets or Mozzarella Sticks
        
        if is_piece_count_item:
            # Extract piece count from the name
            pc_count = ""
            if "(" in base_item.name and ")" in base_item.name:
                pc_info = base_item.name.split("(")[1].split(")")[0]
                if "pc" in pc_info.lower():
                    pc_count = pc_info
                else:
                    pc_count = base_item.size.capitalize()
            else:
                pc_count = base_item.size.capitalize()
            customization_notes.append(f"Size: {pc_count}")
        else:
            size_display = {
                's': 'Small', 
                'm': 'Medium', 
                'l': 'Large',
                'xl': 'Extra Large'
            }.get(size_code, base_item.size)
            customization_notes.append(f"Size: {size_display}")
    
    if removed_ingredients:
        removed_names = []
        for ing_id in removed_ingredients:
            ing = menu.get_item_information(ing_id)
            if ing:
                removed_names.append(ing.name)
            else:
                removed_names.append(ing_id)  # Fallback to ID if name not found
        customization_notes.append(f"Removed: {', '.join(removed_names)}")
    
    if added_ingredients:
        added_names = []
        for ing_id in added_ingredients:
            ing = menu.get_item_information(ing_id)
            if ing:
                added_names.append(ing.name)
            else:
                added_names.append(ing_id)  # Fallback to ID if name not found
        customization_notes.append(f"Added: {', '.join(added_names)}")
    
    # Add the item to the order
    current_order["menuItems"].append({
        "id": item_id,  # Use the specific size item ID
        "name": custom_item.name,
        "price": custom_item.price,
        "quantity": 1,
        "notes": "; ".join(customization_notes)
    })
    
    # Calculate the new total
    current_order["total"] = sum(item["price"] * item["quantity"] for item in current_order["menuItems"])
    
    # Save the updated order
    save_order(current_order, menu.get_items())
    
    # Check if we should suggest sides/drinks or sauces - same logic as in add_to_cart
    suggestion = None
    suggestion_type = None
    
    # For fries, nuggets, and salads, suggest sauces
    if base_item.category == "sides" or "nug" in base_item.id.lower() or base_item.category == "salads":
        suggestion_type = "sauce"
        suggestion = {
            "message": "Would you like any sauce with that?",
            "type": "sauce",
            "item_id": item_id
        }
    # For burgers and sandwiches (entrees), suggest sides and drinks
    elif base_item.category in ['burgers', 'chicken', 'fish']:
        suggestion_type = "entree"
        suggestion = {
            "message": "Would you like to add a side or drink to your order?",
            "type": "entree",
            "item_id": item_id
        }
    
    return jsonify({
        "success": True, 
        "cart": current_order["menuItems"], 
        "total": current_order["total"],
        "suggestion": suggestion,
        "suggestion_type": suggestion_type
    })

@app.route('/api/chat', methods=['POST'])
def chat():
    user_message = request.json.get('message', '')
    conversation_history = request.json.get('conversationHistory', [])
    
    try:
        # Process the order request using the new agent
        result = process_order_request(user_message, menu.get_items())
        
        message_to_user = result.get('message', '')
        updated_order = result.get('updated_order', {})
        
        # Check for termination or checkout
        action_response = None
        if message_to_user.strip() == "TERMINATE_CHAT" or "checkout" in user_message.lower() or "pay" in user_message.lower():
            action_response = "checkout"
            message_to_user = "Great! Taking you to checkout now."
            
        # Get items added or removed
        items_to_add = []
        removed_items = []
        
        # Add items based on the updated order
        menu_items = menu.get_items()
        id_to_item = {item.id: item for item in menu_items}
        
        for item in updated_order.get("menuItems", []):
            if item["id"] in id_to_item:
                items_to_add.append(id_to_item[item["id"]])
        
        return jsonify({
            "response": message_to_user,
            "order": updated_order,
            "items": [menu.serialize_item(item) for item in items_to_add if item],
            "removed_items": removed_items,
            "action": action_response,
            "pendingCombo": False
        })
        
    except Exception as e:
        print(f"Error in chat API: {str(e)}")
        return jsonify({
            "response": "I apologize, but I encountered an error. Please try again.",
            "order": load_current_order(),
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
        
        # Load current order from order.json
        current_order = load_current_order()
        
        # Prepare the order structure if needed
        if "menuItems" not in current_order:
            current_order["menuItems"] = []
        
        removed_items = []
        item_index = None
        item_data = None
        
        # Find the item in the order
        for i, item in enumerate(current_order["menuItems"]):
            if item["id"] == item_id:
                item_index = i
                item_data = item
                break
        
        # If item not found, return error
        if item_index is None:
            return jsonify({
                'success': False,
                'message': 'Item not found in cart'
            }), 404
        
        # If decrease_only and quantity > 1, just decrease the quantity
        if decrease_only and item_data["quantity"] > 1:
            item_data["quantity"] -= 1
            removed_items.append({'id': item_id, 'quantity': 1})
        else:
            # Otherwise remove the item completely
            removed_quantity = item_data["quantity"]
            removed_items.append({'id': item_id, 'quantity': removed_quantity})
            current_order["menuItems"].pop(item_index)
        
        # Recalculate the total
        current_order["total"] = sum(item["price"] * item["quantity"] for item in current_order["menuItems"])
        
        # Save the updated order
        save_order(current_order, menu.get_items())
        
        return jsonify({
            'success': True,
            'cart': current_order["menuItems"],
            'total': current_order["total"],
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

# New endpoint to get available sauces
@app.route('/api/get_sauces', methods=['GET'])
def get_sauces():
    sauces = []
    
    for item in menu.get_items():
        if item.category.lower() == 'condiments' and 'sauce' in item.name.lower():
            sauces.append({
                'id': item.id,
                'name': item.name,
                'price': item.price
            })
    
    return jsonify({
        'success': True,
        'sauces': sorted(sauces, key=lambda x: x['name'])
    })

# New endpoint to get available drinks
@app.route('/api/get_drinks', methods=['GET'])
def get_drinks():
    drinks = []
    
    for item in menu.get_items():
        if item.category.lower() == 'drinks' or item.category.lower() == 'mccafe':
            drinks.append({
                'id': item.id,
                'name': item.name,
                'price': item.price,
                'size': item.size,
            })
    
    return jsonify({
        'success': True,
        'drinks': sorted(drinks, key=lambda x: x['name'])
    })

# New endpoint to get available sides
@app.route('/api/get_sides', methods=['GET'])
def get_sides():
    sides = []
    
    for item in menu.get_items():
        if item.category.lower() == 'sides':
            sides.append({
                'id': item.id,
                'name': item.name,
                'price': item.price,
                'size': item.size
            })
    
    return jsonify({
        'success': True,
        'sides': sorted(sides, key=lambda x: x['name'])
    })

if __name__ == '__main__':
    app.run(debug=True)