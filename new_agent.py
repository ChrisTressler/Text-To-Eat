from openai import OpenAI
import json
import os

client = OpenAI()

def load_menu_data():
    """Load the menu data from menu_data.json"""
    try:
        with open("menu_data.json", "r", encoding='utf-8') as file:
            return json.load(file)
    except Exception as e:
        print(f"Error loading menu data: {e}")
        return {"menuItems": []}

def load_menu_schema():
    with open("menu_schema.json", "r") as file:
        return json.load(file)

def initialize_new_order():
    """Create a fresh empty order and save it"""
    empty_order = {"menuItems": [], "total": 0.0}
    save_order(empty_order)
    return empty_order

def load_current_order():
    """Load the current order from order.json"""
    try:
        with open("order.json", "r", encoding='utf-8') as file:
            order = json.load(file)
            
            # Backward compatibility: convert 'items' to 'menuItems' if needed
            if "items" in order and "menuItems" not in order:
                order["menuItems"] = order["items"]
                order.pop("items", None)
                save_order(order)
                
            return order
    except (FileNotFoundError, json.JSONDecodeError):
        return initialize_new_order()

def translate_ingredient_ids_to_names(notes, menu_items):
    """
    Translate ingredient IDs in the notes to their actual names
    """
    if not notes or len(notes.strip()) == 0:
        return notes
    
    # Create a mapping of ID to item name
    id_to_name = {item.id: item.name for item in menu_items}
    
    # Check for common patterns in notes
    if "Removed:" in notes:
        parts = notes.split(";")
        translated_parts = []
        
        for part in parts:
            part = part.strip()
            if part.startswith("Removed:"):
                # Extract the IDs
                removed_part = part.split("Removed:")[1].strip()
                ids = [id.strip() for id in removed_part.split(",")]
                
                # Translate IDs to names
                names = []
                for id in ids:
                    if id in id_to_name:
                        names.append(id_to_name[id])
                    else:
                        names.append(id)  # Keep original if not found
                
                translated_parts.append(f"Removed: {', '.join(names)}")
            elif part.startswith("Added:"):
                # Extract the IDs
                added_part = part.split("Added:")[1].strip()
                ids = [id.strip() for id in added_part.split(",")]
                
                # Translate IDs to names
                names = []
                for id in ids:
                    if id in id_to_name:
                        names.append(id_to_name[id])
                    else:
                        names.append(id)  # Keep original if not found
                
                translated_parts.append(f"Added: {', '.join(names)}")
            else:
                translated_parts.append(part)  # Keep as is
        
        return "; ".join(translated_parts)
    
    return notes  # Return original if no patterns match

def save_order(order_data, menu_items=None):
    """Save the updated order to order.json"""
    # Ensure we have a valid order structure
    if not order_data:
        order_data = {"menuItems": [], "total": 0.0}
    
    # Convert 'items' to 'menuItems' for consistency if needed
    if "items" in order_data and "menuItems" not in order_data:
        order_data["menuItems"] = order_data["items"]
        order_data.pop("items", None)
    
    # Ensure the required fields exist
    if "menuItems" not in order_data:
        order_data["menuItems"] = []
    if "total" not in order_data:
        # Calculate total from menu items
        order_data["total"] = sum(item.get("price", 0) * item.get("quantity", 1) 
                                for item in order_data["menuItems"])
    
    # Translate ingredient IDs to names in notes if menu_items is provided
    if menu_items is not None:
        for item in order_data["menuItems"]:
            if "notes" in item and item["notes"]:
                item["notes"] = translate_ingredient_ids_to_names(item["notes"], menu_items)
    
    with open("order.json", "w", encoding='utf-8') as file:
        json.dump(order_data, file, indent=4)

def process_order_request(user_message, menu_items, current_order=None):
    """
    Process an order request from the user.
    
    Args:
        user_message (str): The user's message/order request
        menu_items (list): List of menu items
        current_order (dict, optional): Current order data. If None, loads from order.json.
        
    Returns:
        dict: Result dictionary with the processed order information
    """
    if current_order is None:
        current_order = load_current_order()
    
    # Prepare the system message
    system_message = f"""You are a helpful restaurant assistant.
    Here is our menu: {json.dumps([{'name': item.name, 'id': item.id, 'category': item.category} 
                                 for item in menu_items])}
    
    RESPONSE FORMAT:
    Your response must always begin with a JSON object on the first line, followed by two newlines, then your conversational response to the user.
    Only respond in plaintext, do not use markdown, bold, dash or bullet point lists, etc.
    
    The JSON object must contain:
    1. "is_order": true if they're attempting to order food, false otherwise
    2. "is_valid": true if all requested items/modifications match our menu, false otherwise
    3. "is_new_order": true if this is a new order (e.g., "I'd like to order..." or starting a fresh order), false if adding to existing order
    
    Example first line: {{"is_order": true, "is_valid": true, "is_new_order": false}}
    
    CRITICAL RULES FOR ORDER PROCESSING:
    - Item IDs are permanent and must never be modified
    - When customizing items, always use the original menu item ID
    - Never create new IDs for modified items
    - All items, even with customizations, must use IDs from the official menu
    
    CUSTOMER INTERACTION RULES:
    - For burgers, sandwiches, mcnuggets, and fries, always ask what sauce they would like
    - If a customer orders vaguely, ask them to clarify with specific menu options, for example:
    * For "burger" - Ask which burger they would like from our selection on the menu
    * For "McNuggets" - Ask if they want 4pc, 6pc, or 10pc
    * For items with multiple sizes, ask them to clarify. By default and if the user does not clarify, return medium.
    - Be proactive in getting complete order details
    - If a customer orders an entree, ask if they would like a side and drink with it
    
    If the user says 'exit', 'quit', 'bye', 'checkout', or 'goodbye', respond with 'TERMINATE_CHAT'.
    If the user wants to order food, help them place their order and be friendly.
    If they request items not on the menu, kindly let them know what's available instead.
    Keep track of their order across multiple requests."""
    
    try:
        # Add current order context to the message
        context_message = f"Current order: {json.dumps(current_order)}\n\n{user_message}"
        
        # Get the combined evaluation and response
        completion = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": context_message}
            ],
        )
        
        full_response = completion.choices[0].message.content
        
        # Split the response into JSON evaluation and user-facing message
        try:
            # Extract the JSON part (first line) and the conversation part (rest)
            json_str, _, conversation = full_response.partition('\n\n')
            evaluation = json.loads(json_str)
            message_to_user = conversation
            
            is_order = evaluation.get("is_order", False)
            is_valid = evaluation.get("is_valid", False)
            is_new_order = evaluation.get("is_new_order", False)
        except:
            # If parsing fails, treat as a regular conversation
            message_to_user = full_response
            is_order = False
            is_valid = False
            is_new_order = False
        
        result = {
            "message": message_to_user,
            "is_order": is_order,
            "is_valid": is_valid,
            "is_new_order": is_new_order,
            "updated_order": current_order
        }
        
        # Process order if needed
        if is_order and is_valid:
            try:
                # If this is a new order, clear the existing order
                if is_new_order:
                    current_order = {"menuItems": [], "total": 0.0}
                
                # Create menu schema for the response
                menu_schema = load_menu_schema()
                
                # Process the order items
                order_response = client.responses.create(
                    model="gpt-4o",
                    input=[
                        {"role": "system", "content": f"""Here is the menu data:\n{json.dumps([
                            {
                                'id': item.id,
                                'name': item.name,
                                'price': item.price,
                                'category': item.category,
                                'size': item.size
                            } for item in menu_items
                        ])}\n
                        Current order: {json.dumps(current_order)}
                        
                        STRICT ID RULES:
                        - Never modify existing item IDs
                        - Use original menu IDs for all items, even when customized
                        - Do not create new IDs for any reason
                        - All items must use IDs exactly as they appear in the menu
                        - Capture any special requests in the item's "notes" field
                        - Use the "notes" field to record customizations and special instructions
                        
                        - If an item with multiple sizes is ordered but no size is chosen, default to medium."""},
                        {"role": "system", "content": """Process the order request and return the complete updated order in the json schema format.
                        Include all existing items and any additions/modifications requested.
                        Return the complete order with all items, not just the changes.
                        Remember to maintain original item IDs even when modifications are made.
                        If any customizations are made to the item, include them in the notes field.
                        Only include notes if there are customizations to the item."""},
                        {"role": "user", "content": user_message}
                    ],
                    text=menu_schema
                )
                
                # Parse the updated order
                updated_order = json.loads(order_response.output_text)
                # Save the updated order
                save_order(updated_order, menu_items)
                
                # Update the result with the processed order
                result["updated_order"] = updated_order
                
                # Add order confirmation to the assistant's response
                total = updated_order.get("total", 0)
                if "total" not in updated_order:
                    total = sum(item.get("price", 0) * item.get("quantity", 1) 
                                for item in updated_order.get("menuItems", []))
                
                result["message"] += f"\n\n Your current order total is ${total:.2f}"
                
            except Exception as e:
                print(f"Error processing order: {e}")
                result["message"] += "\n\nI apologize, but there was an error processing your order. Please try again."
        
        return result
        
    except Exception as e:
        print(f"Error in process_order_request: {e}")
        return {
            "message": "I apologize, but I encountered an error. Please try again.",
            "is_order": False,
            "is_valid": False,
            "is_new_order": False,
            "updated_order": current_order,
            "error": str(e)
        }