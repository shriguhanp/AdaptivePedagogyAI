import sys
from pathlib import Path
import json

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from src.agents.research.utils.json_utils import extract_json_from_text

def test_extraction(name, text):
    print(f"--- Test: {name} ---")
    print(f"Input: {text!r}")
    try:
        result = extract_json_from_text(text)
        print(f"Result: {result}")
        if result is None:
            print("❌ Failed to extract JSON")
        else:
            print("✅ Success")
    except Exception as e:
        print(f"❌ Exception: {e}")
    print()

def main():
    # Test 1: Standard JSON
    test_extraction("Standard JSON", '{"key": "value"}')

    # Test 2: Markdown code block
    test_extraction("Markdown Code Block", '```json\n{"key": "value"}\n```')

    # Test 3: Multiple braces (Greedy regex failure?)
    # The current regex r"\{[\s\S]*\}" grabs everything from first { to last }
    # Use case: Text before, JSON, Text after with braces
    text = 'Here is the JSON: {"key": "value"} and here is some code {code}'
    test_extraction("Multiple Braces", text)

    # Test 4: Nested braces
    test_extraction("Nested Braces", '{"key": {"nested": "value"}}')

    # Test 5: No JSON at all
    test_extraction("No JSON", "Just some text")

    # Test 6: Partial JSON (should fail)
    test_extraction("Partial JSON", '{"key": "val"')

if __name__ == "__main__":
    main()
