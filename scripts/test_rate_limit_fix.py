#!/usr/bin/env python
import asyncio
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from src.services.llm import factory, exceptions

async def test_rate_limit_fallback():
    print("Testing Rate Limit Fallback...")
    
    # Mock cloud_provider.complete to raise RateLimitError once, then succeed
    mock_complete = AsyncMock()
    
    # First call: Rate Limit Error with Retry-After header
    error = exceptions.LLMRateLimitError("Rate limit exceeded")
    error.retry_after = 600  # 10 minutes
    
    # Setup side_effect: first call raises error, second call succeeds
    mock_complete.side_effect = [error, "Success response from fallback"]
    
    with patch('src.services.llm.cloud_provider.complete', mock_complete):
        # We need to ensure FALLBACK_MODELS has our test case
        factory.FALLBACK_MODELS["test-model-70b"] = "test-model-8b"
        
        print(f"Calling complete() with model='test-model-70b'...")
        start_time = asyncio.get_event_loop().time()
        
        try:
            response = await factory.complete(
                prompt="test",
                model="test-model-70b",
                base_url="https://api.groq.com/openai/v1",
                api_key="mock_key",
                max_retries=1,
                retry_delay=0.1
            )
            
            end_time = asyncio.get_event_loop().time()
            duration = end_time - start_time
            
            print(f"Response: {response}")
            print(f"Duration: {duration:.2f}s")
            
            # Assertions
            if response == "Success response from fallback":
                print("✅ PASSED: Fallback model was used")
            else:
                print(f"❌ FAILED: Unexpected response: {response}")
                
            if duration < 5.0:
                 print("✅ PASSED: Wait time was skipped (fast fallback)")
            else:
                 print(f"❌ FAILED: Took too long ({duration:.2f}s), might have waited for retry_after")
                 
            # Verify call arguments
            print("\nCall history:")
            for i, call in enumerate(mock_complete.call_args_list):
                model_used = call.kwargs.get('model')
                print(f"  Call {i+1}: model={model_used}")
                
            if mock_complete.call_count == 2:
                if mock_complete.call_args_list[0].kwargs['model'] == "test-model-70b" and \
                   mock_complete.call_args_list[1].kwargs['model'] == "test-model-8b":
                    print("✅ PASSED: Model switched correctly")
                else:
                    print("❌ FAILED: Models didn't switch as expected")
            else:
                print(f"❌ FAILED: Expected 2 calls, got {mock_complete.call_count}")

        except Exception as e:
            print(f"❌ FAILED: Exception occurred: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_rate_limit_fallback())
