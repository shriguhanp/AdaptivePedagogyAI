#!/usr/bin/env python3
"""Test script for Mimic Mode question generation."""

import asyncio
from src.tools.question.exam_mimic import mimic_exam_questions


async def main():
    """Test mimic mode question generation."""
    print("=" * 80)
    print("Testing Mimic Mode Question Generation")
    print("=" * 80)
    print()

    # Note: You need to provide a valid PDF path or paper directory
    # For this test, we'll use a paper directory if it exists
    
    # Option 1: Using a PDF file (uncomment and provide path)
    # result = await mimic_exam_questions(
    #     pdf_path="exams/midterm.pdf",
    #     kb_name="calculus",
    #     output_dir="data/user/question/mimic_papers",
    #     max_questions=5
    # )

    # Option 2: Using a pre-parsed paper directory (example)
    # First, let's check if there are any existing parsed papers
    import os
    from pathlib import Path
    
    mimic_papers_dir = Path("data/user/question/mimic_papers")
    
    if mimic_papers_dir.exists():
        subdirs = [d for d in mimic_papers_dir.iterdir() if d.is_dir()]
        if subdirs:
            # Use the first available parsed paper
            paper_name = subdirs[0].name
            print(f"📄 Using existing parsed paper: {paper_name}")
            print()
            
            result = await mimic_exam_questions(
                paper_dir=paper_name,
                kb_name="Intro to AI",  # Using the actual available knowledge base
                output_dir="data/user/question/mimic_papers",
                max_questions=3
            )
        else:
            print("❌ No parsed papers found in data/user/question/mimic_papers")
            print("Please provide a PDF file or create a parsed paper directory first.")
            return
    else:
        print("❌ Mimic papers directory not found: data/user/question/mimic_papers")
        print()
        print("To test mimic mode, you need to either:")
        print("1. Provide a PDF file path using pdf_path parameter")
        print("2. Create a parsed paper directory in data/user/question/mimic_papers")
        print()
        print("Example usage with PDF:")
        print('  result = await mimic_exam_questions(')
        print('      pdf_path="path/to/exam.pdf",')
        print('      kb_name="calculus",')
        print('      output_dir="data/user/question/mimic_papers",')
        print('      max_questions=5')
        print('  )')
        return

    # Display results
    print()
    print("=" * 80)
    print("RESULTS")
    print("=" * 80)
    
    if result.get('success'):
        print(f"✅ Successfully generated questions")
        print(f"📊 Total reference questions: {result.get('total_reference_questions', 0)}")
        
        generated = result.get('generated_questions', [])
        failed = result.get('failed_questions', [])
        
        print(f"✅ Successful generations: {len(generated)}")
        print(f"❌ Failed generations: {len(failed)}")
        print(f"📁 Output file: {result.get('output_file', 'N/A')}")
        
        if generated:
            print()
            print("Generated Questions:")
            print("-" * 80)
            for i, q in enumerate(generated[:3], 1):  # Show first 3
                print(f"\n{i}. Reference: {q.get('reference_question_number', 'N/A')}")
                print(f"   Relevance: {q.get('validation', {}).get('relevance', 'N/A')}")
                print(f"   Rounds: {q.get('rounds', 'N/A')}")
                question_text = q.get('generated_question', {}).get('question', '')
                preview = question_text[:100] + "..." if len(question_text) > 100 else question_text
                print(f"   Preview: {preview}")
    else:
        print(f"❌ Failed: {result.get('error', 'Unknown error')}")

    print()
    print("=" * 80)
    print("Test Complete!")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(main())
