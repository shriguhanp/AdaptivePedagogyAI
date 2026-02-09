#!/usr/bin/env python3
"""Test script for Custom Mode question generation."""

import asyncio
from src.agents.question import AgentCoordinator


async def main():
    """Test custom mode question generation."""
    print("=" * 80)
    print("Testing Custom Mode Question Generation")
    print("=" * 80)
    print()

    # Initialize coordinator
    coordinator = AgentCoordinator(
        kb_name="Intro to AI",  # Using the actual available knowledge base
        output_dir="data/user/question"
    )

    # Generate multiple questions from text requirement
    result = await coordinator.generate_questions_custom(
        requirement={
            "knowledge_point": "deep learning basics",
            "difficulty": "medium",
            "question_type": "choice",
        },
        num_questions=3
    )

    # Display results
    print()
    print("=" * 80)
    print("RESULTS")
    print("=" * 80)
    
    # Check if generation was successful
    if not result.get('success', True):
        print(f"❌ Error: {result.get('error', 'Unknown error')}")
        print(f"   Message: {result.get('message', 'No additional information')}")
        if result.get('search_queries'):
            print(f"   Search queries attempted: {result['search_queries']}")
        return
    
    print(f"✅ Generated {result.get('completed', 0)}/{result.get('requested', 0)} questions")
    print(f"❌ Failed: {result.get('failed', 0)}")
    print()

    if result.get('results'):
        print("Generated Questions:")
        print("-" * 80)
        for i, q in enumerate(result['results'], 1):
            print(f"\n{i}. Question ID: {q.get('question_id', 'N/A')}")
            print(f"   Focus: {q.get('focus', {}).get('focus', 'N/A')}")
            print(f"   Relevance: {q.get('validation', {}).get('relevance', 'N/A')}")
            question_text = q.get('question', {}).get('question', '')
            preview = question_text[:100] + "..." if len(question_text) > 100 else question_text
            print(f"   Preview: {preview}")

    if result.get('output_dir'):
        print(f"\n📁 Output saved to: {result['output_dir']}")

    print()
    print("=" * 80)
    print("Test Complete!")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(main())
