import json
from openai import OpenAI

# Initialize the OpenAI client
client = OpenAI()

# System message for the chatbot
system_message = """You are a helpful fast food restaurant assistant.
You help customers place orders and understand the menu.
Here's a list of menu categories: burgers, sides, drinks, desserts, chicken, fish, breakfast, mccafe, Happy Meal, salads.

IMPORTANT: When identifying items, be VERY specific and use exact names:
- For "coke" or "coca-cola", use "Coca-Cola" (not Diet Coke)
- For nuggets, specify the exact size (4pc, 6pc, 10pc, 20pc, or 40pc) and whether they're regular or spicy
- For fries, specify the size (Small, Medium, or Large) - default to Medium if not specified
- For specialty items, use the full name (e.g., "McFlurry with OREO Cookies" not just "McFlurry")

CART MODIFICATION INSTRUCTIONS:
- When a customer asks to remove something, set ORDER_TYPE to "remove_item"
- When asked to clear the cart, set ORDER_TYPE to "clear_cart" 
- Be specific when identifying items to remove
- For removal requests, respond with a clear confirmation of what was removed

Your response format should be:
ORDER_TYPE: [single_item, remove_item, clear_cart, checkout, general_query]
MAIN_ITEM: [specific item name or "none"]
CUSTOMIZATIONS: [comma-separated list of customizations or "none"]
ACTION: [add_to_cart, remove_from_cart, clear_cart, checkout, respond_only]
MESSAGE: [Your conversational response to the customer]

Examples:
For "I'd like a Big Mac" → "ORDER_TYPE: single_item\nMAIN_ITEM: Big Mac\nCUSTOMIZATIONS: none\nACTION: add_to_cart\nMESSAGE: I've added a Big Mac to your cart."
"""

class OrderAgent:
    def __init__(self, menu):
        self.menu = menu
    
    def process_message(self, user_message, conversation_history=[]):
        """
        Process a message from the user and return a response.
        
        Args:
            user_message (str): The message from the user
            conversation_history (list): List of previous messages in the conversation
            
        Returns:
            dict: A dictionary containing the response and order information
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
            customizations = []
            action = None
            message_to_user = assistant_response
            
            try:
                order_type = assistant_response.split("ORDER_TYPE:")[1].split("\n")[0].strip().lower()
                main_item_section = assistant_response.split("MAIN_ITEM:")[1].split("\n")[0].strip()
                customization_section = assistant_response.split("CUSTOMIZATIONS:")[1].split("\n")[0].strip()
                action = assistant_response.split("ACTION:")[1].split("\n")[0].strip().lower()
                message_section = assistant_response.split("MESSAGE:")[1].strip()
                
                message_to_user = message_section
                
                if main_item_section.lower() != "none":
                    main_item = self.menu.find_item_by_name(main_item_section)
                    if not main_item:
                        main_item = self.menu.find_item_by_name(main_item_section, fuzzy=True)
                
                if customization_section.lower() != "none":
                    customizations = [custom.strip() for custom in customization_section.split(",")]
            
            except Exception as e:
                print(f"Error parsing LLM response: {e}")
                order_type = "general_query"
                action = "respond_only"
                message_to_user = assistant_response
            
            return {
                "order_type": order_type,
                "main_item": main_item,
                "customizations": customizations,
                "action": action,
                "message": message_to_user,
                "raw_response": assistant_response
            }
            
        except Exception as e:
            print(f"Error in process_message: {str(e)}")
            return {
                "order_type": "general_query",
                "main_item": None,
                "customizations": [],
                "action": "respond_only",
                "message": "I apologize, but I encountered an error. Please try again.",
                "error": str(e)
            }
    
    def process_customizations(self, item, customizations):
        """
        Process customizations for an item.
        
        Args:
            item: The menu item to customize
            customizations (list): List of customization strings
            
        Returns:
            tuple: (removed_ingredients, added_ingredients)
        """
        removed_ingredients = []
        added_ingredients = []
        
        for custom in customizations:
            custom = custom.lower()
            if custom.startswith("no "):
                ingredient_name = custom[3:].strip()
                for ing in item.ingredients:
                    if ingredient_name in ing.name.lower():
                        removed_ingredients.append(ing.id)
            elif custom.startswith("extra "):
                ingredient_name = custom[6:].strip()
                for potential_extra in self.menu.get_items():
                    if (potential_extra.category in ['toppings', 'condiments'] and 
                        ingredient_name in potential_extra.name.lower()):
                        added_ingredients.append(potential_extra.id)
        
        return removed_ingredients, added_ingredients 