import json
import re

def extract_json_from_text(text):
    if not text:
        return None

    # 1. Code blocks
    code_block_pattern = re.compile(r"```(?:json)?\s*([\s\S]*?)\s*```")
    for match in code_block_pattern.finditer(text):
        try:
            return json.loads(match.group(1).strip())
        except json.JSONDecodeError:
            continue

    # 2. Iterative finding using JSONDecoder.raw_decode
    decoder = json.JSONDecoder()
    pos = 0
    while pos < len(text):
        # Find next opening brace
        next_obj = text.find('{', pos)
        next_arr = text.find('[', pos)
        
        # Determine which comes first
        if next_obj == -1 and next_arr == -1:
            break
        
        if next_obj != -1 and (next_arr == -1 or next_obj < next_arr):
            start = next_obj
        else:
            start = next_arr
            
        try:
            result, index = decoder.raw_decode(text, start)
            return result
        except json.JSONDecodeError:
            # If failed, move past the opening brace and try again
            pos = start + 1
            
    return None

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

    # Test 2: Markdown Code Block
    test_extraction("Markdown Code Block", '```json\n{"key": "value"}\n```')

    # Test 3: Multiple braces (Failed previously)
    text = 'Here is the JSON: {"key": "value"} and here is some code {code}'
    test_extraction("Multiple Braces", text)

    # Test 4: Nested braces
    test_extraction("Nested Braces", '{"key": {"nested": "value"}}')

    # Test 5: No JSON at all
    test_extraction("No JSON", "Just some text")

    # Test 6: Partial JSON (should fail)
    test_extraction("Partial JSON", '{"key": "val"')

    # Test 7: Array
    test_extraction("Array", '[1, 2, 3]')

    # Test 8: Mixed Objects and Arrays
    test_extraction("Mixed", 'Text [{"a": 1}] Text')

if __name__ == "__main__":
    main()
