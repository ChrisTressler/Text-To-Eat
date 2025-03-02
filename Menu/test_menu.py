import unittest
from menu_with_api import app  # Importing the app from the menu_with_api module


class MenuAPITestCase(unittest.TestCase):

    # Setting the test environment before each test case
    def setUp(self):
        self.app = app.test_client()  # Creating a test client for making requests to the Flask app
        self.app.testing = True  # Setting the app in testing mode to enable better error reporting

    # Test case 1: Retrieving the menu
    def test_get_menu(self):
        response = self.app.get('/menu')  # Sending a GET request to the "/menu" endpoint
        self.assertEqual(response.status_code, 200)  # Checking if the status code is 200 (OK)

        # Checking if the menu contains items like "Big Mac" and "McChicken" (which are present in the JSON file)
        self.assertIn('Big Mac', response.get_data(as_text=True))
        self.assertIn('McChicken', response.get_data(as_text=True))

    # Test case 2: Retrieving a specific item by its ID
    def test_get_item(self):
        # Fetching an item by its ID
        response = self.app.get('/menu/BURG001')
        # Checking if the status code is 200
        self.assertEqual(response.status_code, 200)
        # Checking the item's name, in this case "Big Mac", appears in the response data
        self.assertIn('Big Mac', response.get_data(as_text=True))

    # Test case 3: When an item is not found in the menu
    def test_item_not_found(self):
        # Testing for an item that doesn't exist
        response = self.app.get('/menu/BURG005')
        # Checking if the status code is 404
        self.assertEqual(response.status_code, 404)
        # Checking if the message "Item not found" is in the response data
        self.assertIn('Item not found', response.get_data(as_text=True))

# Running the tests
if __name__ == '__main__':
    unittest.main()