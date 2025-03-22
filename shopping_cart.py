from menu import MenuItem

class ShoppingCart:
    def __init__(self, name):
        self.name = name
        self.items = {}  # Dictionary to store item counts
        self.totalCost = 0.0
    
    def add_item(self, item: MenuItem):
        # Add item to cart and update total cost
        self.items[item] = self.items.get(item, 0) + 1
        self.totalCost += item.price
    
    def remove_item(self, item: MenuItem):
        # Remove item from cart and update total cost
        if item in self.items:
            self.items[item] -= 1
            if self.items[item] == 0:
                del self.items[item]
            self.totalCost -= item.price  # Fixed typo: self.item.price -> item.price
        else:
            raise KeyError(f"Menu item '{item.name}' not found in the cart.")
    
    def get_cart(self):
        return self.items
    
    def get_total_cost(self):
        return self.totalCost
    
    def edit_item(self, old_item, new_item):
        self.remove_item(old_item)
        self.add_item(new_item)