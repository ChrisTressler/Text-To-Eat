from openai import OpenAI
import json
import os
from menu_with_api import menu  # Import the menu object to check available items

client = OpenAI()

def load_menu_data():
    with open("menu_data.json", "r") as file:
        return json.load(file)

def load_menu_schema():
    with open("menu_schema.json", "r") as file:
        return json.load(file)

def initialize_new_order():
    """Create a fresh empty order and save it"""
    empty_order = {"items": [], "total": 0.0}
    save_order(empty_order)
    return empty_order

def load_current_order():
    """Load the current order"""
    try:
        with open("order.json", "r") as file:
            return json.load(file)
    except (FileNotFoundError, json.JSONDecodeError):
        return initialize_new_order()

def save_order(order_data):
    """Save the updated order"""
    with open("order.json", "w") as file:
        json.dump(order_data, file, indent=4)

def merge_orders(current_order, new_items):
    """Merge new items into the current order"""
    if not current_order.get("items"):
        return new_items
    
    # Keep existing items
    merged_order = current_order.copy()
    
    # Add new items to the existing order
    if "items" in new_items:
        merged_order["items"] = new_items["items"]  # Use the updated items list
    
    # Update total
    merged_order["total"] = sum(item.get("price", 0) for item in merged_order["items"])
    
    return merged_order

# Initialize menu items
menu_items = menu.get_items()

# Always start with a fresh order when the script launches
initialize_new_order()
print("Starting with a fresh order...")

# Set up the initial conversation context
messages = [
    {"role": "system", "content": f"""You are a helpful restaurant assistant.
    Here is our menu: {json.dumps([{'name': item.name, 'id': item.id, 'category': item.category} for item in menu_items])}
    
    RESPONSE FORMAT:
    Your response must always begin with a JSON object on the first line, followed by two newlines, then your conversational response to the user.
    
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
    - For burgers, sandwiches, and fries, always ask what sauce they would like
    - If a customer orders vaguely, ask them to clarify with specific menu options, for example:
      * For "burger" - Ask if they want a Big Mac or Quarter Pounder
      * For "McNuggets" - Ask if they want 4pc, 6pc, or 10pc
      * For items with multiple sizes, ask them to clarify. By default and if the user does not clarify, return medium.
    - Be proactive in getting complete order details
    - If a customer orders an entree, ask if they would like a side and drink with it
    
    If the user says 'exit', 'quit', 'bye', 'checkout', or 'goodbye', respond with 'TERMINATE_CHAT'.
    If the user wants to order food, help them place their order and be friendly.
    If they request items not on the menu, kindly let them know what's available instead.
    Keep track of their order across multiple requests."""}
]

print("Welcome to McDonald's ordering system! How can I help you today?")

while True:
    user_input = input("You: ")
    
    # Load current order before processing
    current_order = load_current_order()
    
    # Add current order context to the message
    context_message = f"Current order: {json.dumps(current_order)}\n\n{user_input}"
    messages.append({"role": "user", "content": context_message})
    
    # Get the combined evaluation and response
    completion = client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
    )
    
    full_response = completion.choices[0].message.content
    
    # Split the response into JSON evaluation and user-facing message
    try:
        # Extract the JSON part (first line) and the conversation part (rest)
        json_str, _, conversation = full_response.partition('\n\n')
        evaluation = json.loads(json_str)
        assistant_response = conversation
        
        is_order = evaluation.get("is_order", False)
        is_valid = evaluation.get("is_valid", False)
        is_new_order = evaluation.get("is_new_order", False)
    except:
        # If parsing fails, treat as a regular conversation
        assistant_response = full_response
        is_order = False
        is_valid = False
        is_new_order = False
    
    # Check for termination response
    if assistant_response.strip() == "TERMINATE_CHAT":
        print("Assistant: Goodbye! Have a great day!")
        break
    
    # Process order if needed
    if is_order and is_valid:
        try:
            # If this is a new order, clear the existing order
            if is_new_order:
                current_order = {"items": [], "total": 0.0}
                save_order(current_order)
            
            menu_content = json.dumps(load_menu_data())
            menu_schema = load_menu_schema()
            
            # Process the order items
            order_response = client.responses.create(
                model="gpt-4o",
                input=[
                    {"role": "system", "content": f"""Here is the menu data in json format:\n{menu_content}\n
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
                    Remember to maintain original item IDs even when modifications are made."""},
                    {"role": "user", "content": user_input}
                ],
                text=menu_schema
            )
            
            # Parse and save the updated order
            updated_order = json.loads(order_response.output_text)
            save_order(updated_order)
            
            # Add order confirmation to the assistant's response
            action_type = "started" if is_new_order else "updated"
            total = sum(item["price"] for item in updated_order["menuItems"])
            assistant_response += f"\n\nI've {action_type} your order. Your current order total is ${total:.2f}"
            
        except Exception as e:
            print(e)
            assistant_response += "\n\nI apologize, but there was an error processing your order. Please try again."
    
    # Store the assistant's response in the conversation history
    messages.append({"role": "assistant", "content": full_response})
    
    # Display only the conversation part to the user
    print("Assistant:", assistant_response)