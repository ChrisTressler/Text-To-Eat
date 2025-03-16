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

def load_menu_data():
    with open("menu_data.json", "r") as file:
        return json.load(file)

def load_menu_schema():
    schema = {
        "type": "object",
        "properties": {
            "menuItems": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string"},
                        "name": {"type": "string"},
                        "price": {"type": "number"},
                        "quantity": {"type": "number"},
                        "notes": {"type": "string"}
                    },
                    "required": ["id", "name", "price", "quantity"]
                }
            },
            "total": {"type": "number"}
        },
        "required": ["menuItems", "total"]
    }
    
    try:
        with open("menu_schema.json", "r") as file:
            return json.load(file)
    except (FileNotFoundError, json.JSONDecodeError):
        with open("menu_schema.json", "w") as file:
            json.dump(schema, file, indent=4)
        return schema

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

conversation_history = [
    {"role": "system", "content": f"""You are a helpful restaurant assistant.
    Here is our menu: {json.dumps([{'name': item.name, 'id': item.id, 'category': item.category} for item in menu.get_items()])}
    
    RESPONSE FORMAT:
    Your response must always begin with a JSON object on the first line, followed by two newlines, then your conversational response to the user.
    
    The JSON object must contain:
    1. "is_order": true if they're attempting to order food, false otherwise
    2. "is_valid": true if all requested items/modifications match our menu, false otherwise
    3. "is_new_order": true if this is a new order (e.g., "I'd like to order..." or starting a fresh order), false if adding to existing order
    4. "is_removal": true if they're trying to remove an item from their cart, false otherwise
    5. "remove_items": array of item names/ids to remove, if is_removal is true
    
    Example first line: {{"is_order": true, "is_valid": true, "is_new_order": false, "is_removal": false, "remove_items": []}}
    Example removal: {{"is_order": false, "is_valid": true, "is_new_order": false, "is_removal": true, "remove_items": ["Big Mac"]}}
    
    CRITICAL RULES FOR ORDER PROCESSING:
    - Item IDs are permanent and must never be modified
    - When customizing items, always use the original menu item ID
    - Never create new IDs for modified items
    - All items, even with customizations, must use IDs from the official menu
    
    CART MODIFICATION RULES:
    - If a customer says things like "remove the burger" or "take off the fries", set is_removal to true
    - If a customer says "clear my cart" or "start over", set is_removal to true and include all items in remove_items
    - For removal requests, identify the specific items to remove based on their name
    - If removal is ambiguous, ask for clarification about which items to remove
    
    CUSTOMER INTERACTION RULES:
    - For burgers, sandwiches, and fries, always ask what sauce they would like
    - If a customer orders vaguely, ask them to clarify with specific menu options, for example:
      * For "burger" - Ask if they want a Big Mac or Quarter Pounder
      * For "McNuggets" - Ask if they want 4pc, 6pc, or 10pc
      * For items with multiple sizes, ask them to clarify. By default and if the user does not clarify, return medium.
    - Be proactive in getting complete order details
    - If a customer orders an entree, ask if they would like a side and drink with it
    
    Be as concise as possible. Use new lines and such to make information more digestible.
    If the user says 'exit', 'quit', 'bye', 'checkout', or 'goodbye', respond with 'TERMINATE_CHAT'.
    If the user wants to order food, help them place their order and be friendly.
    If they request items not on the menu, kindly let them know what's available instead.
    Keep track of their order across multiple requests."""}
]

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
    global conversation_history
    
    data = request.json
    user_message = data.get('message', '')
    current_order = data.get('currentOrder', {"menuItems": [], "total": 0.0})
    
    if "items" in current_order and "menuItems" not in current_order:
        current_order = {"menuItems": current_order["items"], "total": current_order.get("total", 0.0)}
    
    context_message = f"Current order: {json.dumps(current_order)}\n\n{user_message}"
    conversation_history.append({"role": "user", "content": context_message})
    
    try:
        completion = client.chat.completions.create(
            model="gpt-4o",
            messages=conversation_history,
        )
        
        full_response = completion.choices[0].message.content
        
        try:
            json_str, _, conversation = full_response.partition('\n\n')
            evaluation = json.loads(json_str)
            assistant_response = conversation
            
            is_order = evaluation.get("is_order", False)
            is_valid = evaluation.get("is_valid", False)
            is_new_order = evaluation.get("is_new_order", False)
            
            is_removal = evaluation.get("is_removal", False)
            remove_items = evaluation.get("remove_items", [])
        except:
            assistant_response = full_response
            is_order = False
            is_valid = False
            is_new_order = False
            is_removal = False
            remove_items = []
        
        if assistant_response.strip() == "TERMINATE_CHAT":
            assistant_response = "Goodbye! Have a great day!"
            action = "checkout"
        else:
            action = None
        
        updated_order = current_order
        order_items = []
        removed_items = []
        
        if is_removal and is_valid and remove_items:
            try:
                cart_items = session.get('cart_items', {})
                
                if "all" in [item.lower() for item in remove_items]:
                    removed_items = [item['name'] for item in cart_items.values()]
                    session['cart_items'] = {}
                    session['cart_total'] = 0.0
                    cart_items = {}
                else:
                    for item_name in remove_items:
                        for item_id, item_data in list(cart_items.items()):
                            if item_name.lower() in item_data['name'].lower():
                                removed_items.append(item_data['name'])
                                
                                price_to_deduct = item_data['price'] * item_data['quantity']
                                
                                del cart_items[item_id]
                                
                                session['cart_total'] = max(0, session.get('cart_total', 0.0) - price_to_deduct)
                
                session['cart_items'] = cart_items
                session.modified = True
                
                updated_menu_items = []
                for item_id, item_data in cart_items.items():
                    updated_menu_items.append({
                        "id": item_data['id'],
                        "name": item_data['name'],
                        "price": item_data['price'],
                        "quantity": item_data['quantity'],
                        "notes": item_data.get('notes', "")
                    })
                
                updated_order = {
                    "menuItems": updated_menu_items,
                    "total": session.get('cart_total', 0.0)
                }
                
                if removed_items:
                    item_list = ", ".join(removed_items)
                    if len(removed_items) == 1:
                        assistant_response += f"\n\nI've removed {item_list} from your cart."
                    else:
                        assistant_response += f"\n\nI've removed these items from your cart: {item_list}."
                    
                    if not cart_items:
                        assistant_response += " Your cart is now empty."
                    else:
                        assistant_response += f" Your current order total is ${updated_order['total']:.2f}"
            
            except Exception as e:
                print(f"Error processing removal: {str(e)}")
                assistant_response += "\n\nI apologize, but there was an error removing the items from your cart. Please try again."
        
        elif is_order and is_valid:
            try:
                if is_new_order:
                    current_order = {"menuItems": [], "total": 0.0}
                
                menu_data = load_menu_data()
                menu_content = json.dumps(menu_data)
                menu_schema = load_menu_schema()
                
                possible_items = []
                lower_message = user_message.lower()
                
                item_keywords = {
                    "big mac": "BURG001",
                    "quarter pounder": "BURG002",
                    "fries": "SIDE001",
                    "french fries": "SIDE001",
                    "coke": "DRINK001",
                    "coca-cola": "DRINK001",
                    "sprite": "DRINK002",
                    "mcnuggets": "CHIK001",
                    "chicken nuggets": "CHIK001",
                }
                
                sauce_keywords = {
                    "ketchup": "COND001",
                    "mayo": "COND002",
                    "mayonnaise": "COND002",
                    "bbq": "COND003",
                    "bbq sauce": "COND003",
                    "mustard": "COND004",
                    "big mac sauce": "COND005"
                }
                
                for keyword, item_id in item_keywords.items():
                    if keyword in lower_message:
                        item_info = next((item for item in menu_data["menuItems"] 
                                          if item["id"] == item_id), None)
                        if item_info:
                            possible_items.append({
                                "id": item_id,
                                "name": item_info["name"],
                                "price": item_info["price"],
                                "quantity": 1,
                                "notes": ""
                            })
                
                sauce_note = ""
                for keyword, sauce_id in sauce_keywords.items():
                    if keyword in lower_message:
                        sauce_info = next((item for item in menu_data["menuItems"] 
                                          if item["id"] == sauce_id), None)
                        if sauce_info:
                            sauce_note = f"With {sauce_info['name']}"
                
                for item in possible_items:
                    if item["id"] == "SIDE001" and sauce_note:
                        item["notes"] = sauce_note
                
                is_combo = "combo" in lower_message or "meal" in lower_message
                
                if is_combo and any(item["id"] == "BURG001" for item in possible_items):
                    if not any(item["id"] == "SIDE001" for item in possible_items):
                        fries_info = next((item for item in menu_data["menuItems"] 
                                          if item["id"] == "SIDE001"), None)
                        if fries_info:
                            possible_items.append({
                                "id": "SIDE001",
                                "name": fries_info["name"],
                                "price": fries_info["price"],
                                "quantity": 1,
                                "notes": sauce_note
                            })
                    
                    if not any(item["id"] in ["DRINK001", "DRINK002"] for item in possible_items):
                        drink_info = next((item for item in menu_data["menuItems"] 
                                          if item["id"] == "DRINK001"), None)
                        if drink_info:
                            possible_items.append({
                                "id": "DRINK001",
                                "name": drink_info["name"],
                                "price": drink_info["price"],
                                "quantity": 1,
                                "notes": ""
                            })
                
                updated_menu_items = current_order.get("menuItems", []) + possible_items
                
                total = sum(item["price"] * item["quantity"] for item in updated_menu_items)
                
                updated_order = {
                    "menuItems": updated_menu_items,
                    "total": total
                }
                
                for item in possible_items:
                    cart_item = {
                        'id': item['id'],
                        'name': item['name'],
                        'price': item['price'],
                        'quantity': item['quantity']
                    }
                    
                    cart_items = session.get('cart_items', {})
                    if item['id'] in cart_items:
                        cart_items[item['id']]['quantity'] += 1
                    else:
                        cart_items[item['id']] = cart_item
                    
                    session['cart_items'] = cart_items
                    session['cart_total'] = session.get('cart_total', 0.0) + item['price']
                    
                order_items = possible_items
                
                if possible_items:
                    action_type = "started" if is_new_order else "updated"
                    item_list = ", ".join([f"{item['name']}{' with ' + item['notes'] if item['notes'] else ''}" 
                                         for item in possible_items])
                    assistant_response += f"\n\nI've {action_type} your order with: {item_list}. Your current order total is ${updated_order['total']:.2f}"
                
            except Exception as e:
                print(f"Error processing order: {str(e)}")
                assistant_response += "\n\nI apologize, but there was an error processing your order. Please try again."
        
        conversation_history.append({"role": "assistant", "content": full_response})
        
        session.modified = True

        return jsonify({
            "response": assistant_response,
            "order": updated_order,
            "items": order_items,
            "removed_items": removed_items,
            "action": action
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
        data = request.json
        item_id = data.get('item_id')
        decrease_only = data.get('decrease_only', False)
        
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
        else:
            removed_quantity = cart_items[item_id]['quantity']
            removed_items.append({'id': item_id, 'quantity': removed_quantity})
            del cart_items[item_id]
        
        total = sum(item['price'] * item['quantity'] for item in cart_items.values())
        
        session['cart_items'] = cart_items
        session['cart_total'] = total
        session.modified = True
        
        return jsonify({
            'success': True,
            'cart': cart_items,
            'total': total,
            'removed_items': removed_items
        })
        
    except Exception as e:
        print(f"Error in remove_from_cart: {str(e)}")
        return jsonify({
            'success': False,
            'message': f'Error removing item from cart: {str(e)}'
        }), 500

if __name__ == '__main__':
    app.run(debug=True)