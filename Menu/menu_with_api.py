import json
from typing import List, Optional
from flask import Flask, jsonify, request

app = Flask(__name__)

# Defining a type alias for a list of strings
str_list = List[str]

# Class representing a menu item
class MenuItem:
    def __init__(self, name: str, id: str, price: float, ingredients: str_list,
                 combo: bool, size: str, category: str, description: str):
        self.name = name                # Assigning the name of the menu item
        self.id = id                    # Assigning the unique identifier for the menu item
        self.price = price              # Assigning the price of the menu item
        self.ingredients = ingredients  # Listing underlying ingredients
        self.combo = combo              # Boolean flag indicating if the menu item is part of a combo
        self.size = size                # The size of the menu item
        self.category = category        # Category to which the item belongs
        self.description = description  # A textual description of the menu item

    # Returning a string representation of a MenuItem
    def __str__(self):
        return f"{self.name} (ID: {self.id})"

# Class representing a menu which contains a collection of MenuItem objects
class Menu:
    def __init__(self):
        # Initializing a dictionary to store MenuItem objects, keyed by their IDs
        self.items = {}

    def load_menu(self, json_file: str):
        # Loading menu data from a JSON file
        with open(json_file, 'r') as file:
            data = json.load(file)  # Parse the JSON file

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
                description=item['description']
            )
            # Adding the MenuItem to the items dictionary, using its ID as the key
            self.items[item['id']] = menu_item

        # Resolving ingredient references
        for item in self.items.values():
            item.ingredients = [self.items[ing_id] for ing_id in item.ingredients if ing_id in self.items]

    # Getting information about a specific item based on its ID
    def get_item_information(self, item_id: str) -> Optional[MenuItem]:
        """Returns a menu item by ID."""
        return self.items.get(item_id)  # Returning the MenuItem if found, otherwise None

    # Getting all items
    def get_items(self, category: Optional[str] = None) -> List[MenuItem]:
        # Returning a list of items that belong to the specified category
        if category:
            return [item for item in self.items.values() if item.category == category]
        # Returning all items if no category is specified
        return list(self.items.values())

# Initialize Menu object
menu = Menu()  # Creating a new Menu object
menu.load_menu("menu_data.json")   # Loading menu data from a JSON file

# Flask route for getting item details by item_id
@app.route("/menu/<item_id>", methods=["GET"])
def get_item(item_id: str):
    # Retrieve item information based on item_id
    item = menu.get_item_information(item_id)

    if item:
        # If item is found, returning the item details as JSON
        return jsonify({
            "name": item.name,
            "id": item.id,
            "price": item.price,
            "ingredients": [ingredient.name for ingredient in item.ingredients],  # List of ingredient names
            "combo": item.combo,
            "size": item.size,
            "category": item.category,
            "description": item.description
        })
    else:
        # If item not found, returning a 404 error with a message
        return jsonify({"error": "Item not found"}), 404

# Flask route to load data before the first request is processed
@app.before_first_request
def load_data():
    # Loading the menu data when the app starts or before any request
    menu.load_menu("menu_data.json")

# Running the Flask app in debug mode
if __name__ == "__main__":
    app.run(debug=True)