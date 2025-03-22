import json
from typing import List, Optional

# Defining a type alias for a list of strings
str_list = List[str]

# Class representing a menu item
class MenuItem:
    def __init__(self, name: str, id: str, price: float, ingredients: str_list,
                 combo: bool, size: str, category: str, description: str,
                 customizable: bool = False, free_add_ons: str_list = None, 
                 paid_add_ons: str_list = None):
        self.name = name                # Assigning the name of the menu item
        self.id = id                    # Assigning the unique identifier for the menu item
        self.price = price              # Assigning the price of the menu item
        self.ingredients = ingredients  # Listing underlying ingredients
        self.combo = combo              # Boolean flag indicating if the menu item is part of a combo
        self.size = size                # The size of the menu item
        self.category = category        # Category to which the item belongs
        self.description = description  # A textual description of the menu item
        self.customizable = customizable  # Whether this item can be customized
        self.free_add_ons = free_add_ons or []  # Free add-ons available for this item
        self.paid_add_ons = paid_add_ons or []  # Paid add-ons available for this item

    # Returning a string representation of a MenuItem
    def __str__(self):
        return f"{self.name} (ID: {self.id})"

# Class representing a menu which contains a collection of MenuItem objects
class Menu:
    def __init__(self):
        # Initializing a dictionary to store MenuItem objects, keyed by their IDs
        self.items = {}

    def load_menu(self, filename: str):
        # Loading menu data from a JSON file
        with open(filename, 'r', encoding='utf-8') as file:
            data = json.load(file)  # Parsing the JSON data

        # Iterating through each item in the loaded menu data
        for item in data['menuItems']:
            # Creating a MenuItem object for each item in the data
            menu_item = MenuItem(
                name=item['name'],
                id=item['id'],
                price=item['price'],
                ingredients=item['ingredients'],
                combo=item['combo'],
                size=item['size'],
                category=item['category'],
                description=item['description'],
                customizable=item.get('customizable', False),
                free_add_ons=item.get('freeAddOns', []),
                paid_add_ons=item.get('paidAddOns', [])
            )
            # Adding the MenuItem to the items dictionary, using its ID as the key
            self.items[item['id']] = menu_item

        # Resolving ingredient references
        for item in self.items.values():
            # Resolve ingredients
            item.ingredients = [self.items[ing_id] for ing_id in item.ingredients if ing_id in self.items]
            # Resolve free add-ons
            item.free_add_ons = [self.items[ing_id] for ing_id in item.free_add_ons if ing_id in self.items]
            # Resolve paid add-ons
            item.paid_add_ons = [self.items[ing_id] for ing_id in item.paid_add_ons if ing_id in self.items]

    # Getting information about a specific item based on its ID
    def get_item_information(self, item_id: str) -> Optional[MenuItem]:
        return self.items.get(item_id)  # Returning the MenuItem if found, otherwise None

    # Getting all items
    def get_items(self, category: Optional[str] = None) -> List[MenuItem]:
        if category:
            # Returning a list of items that belong to the specified category
            return [item for item in self.items.values() if item.category == category]
        # Returning all items if no category is specified
        return list(self.items.values())
    
    # Serialize a menu item for JSON response
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
            'size': item.size,
            'customizable': item.customizable
        }
        
        # Include ingredients if they exist
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
        
        # Include free add-ons if they exist
        if hasattr(item, 'free_add_ons') and item.free_add_ons:
            serialized['freeAddOns'] = []
            for ing in item.free_add_ons:
                serialized['freeAddOns'].append({
                    'id': ing.id,
                    'name': ing.name,
                    'price': 0  # Free add-ons have no cost
                })
        else:
            serialized['freeAddOns'] = []
        
        # Include paid add-ons if they exist
        if hasattr(item, 'paid_add_ons') and item.paid_add_ons:
            serialized['paidAddOns'] = []
            for ing in item.paid_add_ons:
                serialized['paidAddOns'].append({
                    'id': ing.id,
                    'name': ing.name,
                    'price': ing.price
                })
        else:
            serialized['paidAddOns'] = []
        
        return serialized

if __name__ == "__main__":
    menu = Menu()  # Creating a new Menu object
    menu.load_menu("menu_data.json")  # Loading menu data from a JSON file

    # Getting information about a specific item
    burger = menu.get_item_information("BURG001")
    if burger:
        print(f"Item: {burger.name}")
        print(f"Price: ${burger.price}")
        print(f"Customizable: {burger.customizable}")
        print("Ingredients:")
        for ingredient in burger.ingredients:
            print(f"- {ingredient.name}")
        print("Free Add-ons:")
        for addon in burger.free_add_ons:
            print(f"- {addon.name}")
        print("Paid Add-ons:")
        for addon in burger.paid_add_ons:
            print(f"- {addon.name} (${addon.price})")

    # Getting all items in the "burgers" category
    burgers = menu.get_items(category="burgers")
    print("\nAll burgers:")
    for burger in burgers:
        print(f"- {burger.name}")