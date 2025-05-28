"""
Final converted Python file with enhanced features
This file demonstrates how MCP context improves code conversion
"""

from typing import List, Union
import logging

# Setup logging based on project context
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MathProcessor:
    """
    Enhanced version of the original JavaScript functions
    Converted with MCP context awareness
    """
    
    def __init__(self):
        logger.info("MathProcessor initialized")
    
    def calculate_sum(self, numbers: List[Union[int, float]]) -> Union[int, float]:
        """
        Calculate the sum of a list of numbers
        
        Args:
            numbers: List of numeric values
            
        Returns:
            Sum of all numbers in the list
            
        Raises:
            TypeError: If input is not a list
            ValueError: If list contains non-numeric values
        """
        if not isinstance(numbers, list):
            raise TypeError("Input must be a list")
        
        if not numbers:
            return 0
        
        # Validate all elements are numeric
        for num in numbers:
            if not isinstance(num, (int, float)):
                raise ValueError(f"All elements must be numeric, got {type(num)}")
        
        result = sum(numbers)
        logger.debug(f"Sum calculated: {result}")
        return result
    
    def process_data(self, data: List[Union[int, float]]) -> List[Union[int, float]]:
        """
        Filter positive numbers and double them
        
        Args:
            data: List of numeric values to process
            
        Returns:
            List of positive numbers doubled
        """
        if not isinstance(data, list):
            raise TypeError("Input must be a list")
        
        # Filter positive numbers and double them
        processed = [item * 2 for item in data if isinstance(item, (int, float)) and item > 0]
        
        logger.info(f"Processed {len(data)} items, returned {len(processed)} positive values")
        return processed

# Example usage and testing
if __name__ == "__main__":
    processor = MathProcessor()
    
    # Test data
    test_numbers = [1, 2, 3, 4, 5]
    test_mixed = [-2, -1, 0, 1, 2, 3]
    
    # Demonstrate functionality
    print("=== Math Processor Demo ===")
    print(f"Sum of {test_numbers}: {processor.calculate_sum(test_numbers)}")
    print(f"Processed {test_mixed}: {processor.process_data(test_mixed)}")
    
    # Error handling demo
    try:
        processor.calculate_sum("not a list")
    except TypeError as e:
        print(f"Caught expected error: {e}")
