# Text-To-Eat Menu with API Project Documentation

## Project Components

### **1. `menu.py`**: Core Menu Functionality

This file contains the logic and classes that handle managing the menu items.

**`MenuItem` class**: 
Represents a single menu item, including attributes such as `name`, `id`, `price`, `ingredients`, `combo`, `size`, `category`, and `description`.  <br>
**`Menu` class**: 
Manages a collection of `MenuItem` objects. Provides methods for loading menu data, retrieving items by ID, and filtering by category.

### **2. `menu_with_api.py`**: Flask API for Serving Menu Data

This file sets up the Flask application and defines the API routes to interact with the menu.

**Route**: `/menu/<item_id>` to get details of a specific item by ID. <br>
**Route**: `/menu` to return all menu items or filter by category.

The Flask app is configured to load menu data on startup and respond to requests accordingly.

### **3. `test_menu.py`**: Unit Tests for the Menu API

This file includes unit tests designed to ensure the correct behavior of the menu API.

**Tests**: <br>
`test_get_menu`: Ensures the `/menu` route retrieves the entire menu and includes specific items. <br>
`test_get_item`: Verifies that the `/menu/<item_id>` route returns the correct menu item. <br>
`test_item_not_found`: Tests the case when a non-existent item is requested, expecting a 404 error. <br>

### **4. `menu_data.json`**: Sample Menu Data (JSON format)

This file contains sample data for menu items (inspired by McDonald's menu) in JSON format. The data includes essential attributes for each menu item, such as `name`, `id`, `price`, `ingredients`, `size`, `category`, and `description`.

Example:
{
  "menuItems": [
    {
      "name": "Big Mac",
      "id": "BURG001",
      "price": 5.99,
      "ingredients": ["BUN001", "MEAT001", "CHEESE001"],
      "size": "medium",
      "category": "burgers",
      "description": "A delicious burger with two all-beef patties."
    }
  ]
}

## Dependencies

pip install flask <br>
python -m pip install --upgrade pip

### Run the Flask API:
python menu_with_api.py

### Run unit tests:
python menu_with_api.py

### Run menu.py:
python menu.py

## References
[https://www.geeksforgeeks.org/flask-creating-first-simple-application/](https://www.geeksforgeeks.org/flask-creating-first-simple-application/)  <br>
[https://flask.palletsprojects.com/en/stable/quickstart/](https://flask.palletsprojects.com/en/stable/quickstart/)
