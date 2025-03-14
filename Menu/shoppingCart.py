from menu import *

class ShoppingCart:
    items  = {}
    name = ""
    totalCost = 0


    def __init__(self,name):
        self.name = name
        self.items = {}  # Dictionary to store item counts
        self.totalCost = 0.0 
    
    def add_item(self,item: MenuItem):
        # need to add some logic here to add to cost
        self.items[item] = self.items.get(item,0) + 1
        self.totalCost+= item.price
    
    def remove_item(self,item: MenuItem):
        # need to add logic here to reduce cost once the menu class has been implemented 
        if item in self.items:
            self.items[item]-=1
            if self.items[item] == 0:
                del self.items[item]
            self.totalCost-=self.item.price
        else:
            raise KeyError(f"Menu item '{item.name}' not found in the cart.")
        
    def getCart(self):
        return self.items

    def getTotalCost(self):
        return self.totalCost
    
    def editItem(self,oldItem,newItem):
        self.remove_item(oldItem)
        self.add_item(newItem)
            


    