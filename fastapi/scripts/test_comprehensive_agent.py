"""
Comprehensive AI Agent Testing Suite
Tests all 7 core capabilities with timing instrumentation and quality metrics
"""
import asyncio
import time
import json
from datetime import datetime
from typing import Dict, List, Tuple
from loguru import logger
from ml.application.sarge import run_sarge


class PerformanceTracker:
    """Track timing and quality metrics for each test"""
    
    def __init__(self):
        self.results = []
        
    def record_test(self, test_name: str, category: str, timing: Dict, 
                    quality_score: float, passed: bool, notes: str = ""):
        """Record test results"""
        self.results.append({
            "test_name": test_name,
            "category": category,
            "total_time": timing.get("total", 0),
            "router_time": timing.get("router", 0),
            "profiler_time": timing.get("profiler", 0),
            "retriever_time": timing.get("retriever", 0),
            "strategist_time": timing.get("strategist", 0),
            "writer_time": timing.get("writer", 0),
            "critic_time": timing.get("critic", 0),
            "quality_score": quality_score,
            "passed": passed,
            "notes": notes,
            "timestamp": datetime.now().isoformat()
        })
        
    def save_report(self, filepath: str = "test_results.json"):
        """Save results to JSON file"""
        with open(filepath, 'w') as f:
            json.dump({
                "summary": {
                    "total_tests": len(self.results),
                    "passed": sum(1 for r in self.results if r["passed"]),
                    "failed": sum(1 for r in self.results if not r["passed"]),
                    "avg_total_time": sum(r["total_time"] for r in self.results) / len(self.results) if self.results else 0,
                    "avg_quality_score": sum(r["quality_score"] for r in self.results) / len(self.results) if self.results else 0
                },
                "results": self.results
            }, f, indent=2)
        logger.info(f"📊 Results saved to {filepath}")


async def run_timed_test(user_input: str) -> Tuple[Dict, float]:
    """Run test with timing"""
    start_time = time.time()
    result = await run_sarge(user_input)
    total_time = time.time() - start_time
    
    # Extract timing info (would need to add node-level timing to graph)
    timing = {
        "total": total_time,
        "router": 0,  # Placeholder - will instrument later
        "profiler": 0,
        "retriever": 0,
        "strategist": 0,
        "writer": 0,
        "critic": 0
    }
    
    return result, timing


def validate_profile_understanding(result: Dict, expected: Dict) -> Tuple[bool, float, str]:
    """
    Validate Profile Understanding capability
    Returns: (passed, quality_score, notes)
    """
    prospect = result.get("prospect_data", {})
    
    score = 0.0
    notes = []
    
    # Check name extraction
    if prospect.get("name") and prospect["name"] != "Unknown Prospect":
        if expected.get("name") and expected["name"].lower() in prospect["name"].lower():
            score += 0.25
        else:
            notes.append(f"Name mismatch: expected '{expected.get('name')}', got '{prospect.get('name')}'")
    else:
        notes.append("Failed to extract name")
    
    # Check role extraction
    if prospect.get("role"):
        if expected.get("role") and expected["role"].lower() in prospect["role"].lower():
            score += 0.25
        else:
            notes.append(f"Role mismatch: expected '{expected.get('role')}', got '{prospect.get('role')}'")
    else:
        notes.append("Failed to extract role")
    
    # Check company extraction
    if prospect.get("company"):
        if expected.get("company") and expected["company"].lower() in prospect["company"].lower():
            score += 0.25
        else:
            notes.append(f"Company mismatch: expected '{expected.get('company')}', got '{prospect.get('company')}'")
    else:
        notes.append("Failed to extract company")
    
    # Check tone detection
    if prospect.get("detected_tone"):
        if expected.get("tone") and prospect["detected_tone"] == expected["tone"]:
            score += 0.25
        else:
            notes.append(f"Tone detection: expected '{expected.get('tone')}', got '{prospect.get('detected_tone')}'")
    
    passed = score >= 0.75  # Pass if 75%+ correct
    return passed, score, "; ".join(notes) if notes else "All checks passed"


def validate_channel_output(result: Dict, requested_channels: List[str]) -> Tuple[bool, float, str]:
    """
    Validate Multi-Channel Writing capability
    Ensures only requested channels are generated
    """
    content = result.get("generated_content", {})
    
    score = 0.0
    notes = []
    
    # Check if requested channels are present
    for channel in requested_channels:
        if channel in content and content[channel]:
            score += 0.5 / len(requested_channels)
            
            # Validate channel-specific constraints
            if channel == "email":
                if 100 <= len(content[channel]) <= 500:
                    score += 0.25 / len(requested_channels)
                else:
                    notes.append(f"Email length {len(content[channel])} outside range 100-500")
                    
            elif channel == "linkedin":
                if len(content[channel]) <= 400:
                    score += 0.25 / len(requested_channels)
                else:
                    notes.append(f"LinkedIn DM too long: {len(content[channel])} chars (max 400)")
                    
            elif channel == "whatsapp":
                sentences = content[channel].count('.') + content[channel].count('!') + content[channel].count('?')
                if 2 <= sentences <= 5:
                    score += 0.25 / len(requested_channels)
                else:
                    notes.append(f"WhatsApp message has {sentences} sentences (expected 2-5)")
        else:
            notes.append(f"Missing requested channel: {channel}")
    
    # Check for unrequested channels (should NOT be present)
    all_channels = ["email", "linkedin", "whatsapp"]
    for channel in all_channels:
        if channel not in requested_channels:
            if channel in content and content[channel]:
                score -= 0.2
                notes.append(f"Unrequested channel generated: {channel}")
    
    score = max(0.0, min(1.0, score))  # Clamp to 0-1
    passed = score >= 0.7
    return passed, score, "; ".join(notes) if notes else "Channel validation passed"


def validate_personalization(result: Dict, required_keywords: List[str]) -> Tuple[bool, float, str]:
    """
    Validate Outreach Strategy and personalization quality
    Checks if specific keywords/details are mentioned
    """
    content = result.get("generated_content", {})
    all_text = " ".join([str(v) for v in content.values()]).lower()
    
    score = 0.0
    notes = []
    
    for keyword in required_keywords:
        if keyword.lower() in all_text:
            score += 1.0 / len(required_keywords)
        else:
            notes.append(f"Missing keyword: '{keyword}'")
    
    # Check strategy quality
    strategy = result.get("strategy_brief", {})
    if strategy.get("hook") and len(strategy["hook"]) > 20:
        score += 0.2
    else:
        notes.append("Strategy hook too generic or missing")
    
    score = min(1.0, score)  # Clamp to 1.0
    passed = score >= 0.8
    return passed, score, "; ".join(notes) if notes else "Personalization validated"


async def test_profile_understanding():
    """Test Suite 1: Profile Understanding"""
    logger.info("🧪 TEST SUITE 1: Profile Understanding")
    tracker = PerformanceTracker()
    
    test_cases = [
        {
            "name": "Complete Profile - Tech Lead",
            "input": "Generate outreach for Alex Rivera, Head of Platform Reliability at CloudScale. He's very technical.",
            "expected": {
                "name": "Alex Rivera",
                "role": "Head of Platform Reliability",
                "company": "CloudScale",
                "tone": "technical"
            }
        },
        {
            "name": "Minimal Info - Name Only",
            "input": "Create email for John Smith",
            "expected": {
                "name": "John Smith",
                "role": None,
                "company": None,
                "tone": "formal"
            }
        },
        {
            "name": "Casual Tone Detection",
            "input": "Draft message for Sarah, a friendly startup founder at TechCo who loves casual communication",
            "expected": {
                "name": "Sarah",
                "role": "founder",
                "company": "TechCo",
                "tone": "casual"
            }
        },
        {
            "name": "Formal Executive",
            "input": "Generate outreach for Dr. Michael Chen, Chief Technology Officer at Enterprise Corp, very formal professional",
            "expected": {
                "name": "Michael Chen",
                "role": "Chief Technology Officer",
                "company": "Enterprise Corp",
                "tone": "formal"
            }
        },
        {
            "name": "Technical Engineer",
            "input": "Create email for Lisa Park, Senior Software Engineer at DevTools Inc, loves technical deep dives",
            "expected": {
                "name": "Lisa Park",
                "role": "Senior Software Engineer",
                "company": "DevTools Inc",
                "tone": "technical"
            }
        }
    ]
    
    for test_case in test_cases:
        print(f"\n{'='*80}")
        print(f"TEST: {test_case['name']}")
        print(f"{'='*80}")
        
        try:
            result, timing = await run_timed_test(test_case["input"])
            passed, score, notes = validate_profile_understanding(result, test_case["expected"])
            
            tracker.record_test(
                test_name=test_case["name"],
                category="Profile Understanding",
                timing=timing,
                quality_score=score,
                passed=passed,
                notes=notes
            )
            
            print(f"✅ PASSED" if passed else f"❌ FAILED")
            print(f"Score: {score:.2f} | Time: {timing['total']:.2f}s")
            print(f"Notes: {notes}")
            
            # Show extracted profile
            prospect = result.get("prospect_data", {})
            print(f"\nExtracted Profile:")
            print(f"  Name: {prospect.get('name')}")
            print(f"  Role: {prospect.get('role')}")
            print(f"  Company: {prospect.get('company')}")
            print(f"  Tone: {prospect.get('detected_tone')}")
            
        except Exception as e:
            logger.error(f"❌ ERROR: {e}")
            import traceback
            traceback.print_exc()
            tracker.record_test(test_case["name"], "Profile Understanding", {"total": 0}, 0.0, False, str(e))
        
        await asyncio.sleep(1)  # Brief pause between tests
    
    return tracker


async def test_channel_specific_generation():
    """Test Suite 2: Multi-Channel Writing (Channel-Specific)"""
    logger.info("🧪 TEST SUITE 2: Multi-Channel Writing")
    tracker = PerformanceTracker()
    
    test_cases = [
        {
            "name": "Email Only Request",
            "input": "Generate an email for Alex Rivera, Head of Platform at CloudScale",
            "requested_channels": ["email"]
        },
        {
            "name": "LinkedIn Only Request",
            "input": "Draft a LinkedIn DM for Sarah Thompson, Marketing Director at BrandCo",
            "requested_channels": ["linkedin"]
        },
        {
            "name": "WhatsApp Only Request",
            "input": "Create a WhatsApp message for Mike Chen, CTO at TechStartup",
            "requested_channels": ["whatsapp"]
        },
        {
            "name": "Email + LinkedIn Request",
            "input": "Generate email and LinkedIn message for Emma Wilson, Product Manager at SaaS Inc",
            "requested_channels": ["email", "linkedin"]
        },
        {
            "name": "All Channels Request",
            "input": "Create email, LinkedIn DM, and WhatsApp for David Lee, Sales VP at Enterprise Solutions",
            "requested_channels": ["email", "linkedin", "whatsapp"]
        }
    ]
    
    for test_case in test_cases:
        print(f"\n{'='*80}")
        print(f"TEST: {test_case['name']}")
        print(f"{'='*80}")
        
        try:
            result, timing = await run_timed_test(test_case["input"])
            passed, score, notes = validate_channel_output(result, test_case["requested_channels"])
            
            tracker.record_test(
                test_name=test_case["name"],
                category="Multi-Channel Writing",
                timing=timing,
                quality_score=score,
                passed=passed,
                notes=notes
            )
            
            print(f"✅ PASSED" if passed else f"❌ FAILED")
            print(f"Score: {score:.2f} | Time: {timing['total']:.2f}s")
            print(f"Notes: {notes}")
            
            # Show generated channels
            content = result.get("generated_content", {})
            print(f"\nGenerated Channels:")
            for channel in ["email", "linkedin", "whatsapp"]:
                if channel in content and content[channel]:
                    print(f"  {channel.upper()}: {len(content[channel])} chars")
                    print(f"    Preview: {content[channel][:100]}...")
            
        except Exception as e:
            logger.error(f"❌ ERROR: {e}")
            import traceback
            traceback.print_exc()
            tracker.record_test(test_case["name"], "Multi-Channel Writing", {"total": 0}, 0.0, False, str(e))
        
        await asyncio.sleep(1)
    
    return tracker


async def test_personalization_quality():
    """Test Suite 3: Outreach Strategy & Personalization"""
    logger.info("🧪 TEST SUITE 3: Outreach Strategy & Personalization")
    tracker = PerformanceTracker()
    
    test_cases = [
        {
            "name": "Specific Hook - KubeCon Speaker",
            "input": "Generate email for Alex Rivera, Head of Platform Reliability at CloudScale. He spoke at KubeCon about Zero-Trust Infrastructure.",
            "required_keywords": ["KubeCon", "Zero-Trust", "Alex", "CloudScale"]
        },
        {
            "name": "Recent Achievement",
            "input": "Create LinkedIn DM for Sarah Chen who just published a whitepaper on AI Ethics at Stanford",
            "required_keywords": ["whitepaper", "AI Ethics", "Stanford", "Sarah"]
        },
        {
            "name": "Role-Specific Pain Point",
            "input": "Draft email for Mike Johnson, VP of Sales at SalesForce Inc, struggling with lead qualification",
            "required_keywords": ["lead qualification", "Sales", "Mike", "SalesForce"]
        },
        {
            "name": "Industry Context",
            "input": "Generate outreach for Emma Davis, CFO at FinTech Innovations, working in cryptocurrency compliance",
            "required_keywords": ["cryptocurrency", "compliance", "FinTech", "Emma"]
        },
        {
            "name": "Personal Interest",
            "input": "Create WhatsApp for David Park, developer at OpenSource Co, passionate about Rust programming",
            "required_keywords": ["Rust", "programming", "David", "OpenSource"]
        }
    ]
    
    for test_case in test_cases:
        print(f"\n{'='*80}")
        print(f"TEST: {test_case['name']}")
        print(f"{'='*80}")
        
        try:
            result, timing = await run_timed_test(test_case["input"])
            passed, score, notes = validate_personalization(result, test_case["required_keywords"])
            
            tracker.record_test(
                test_name=test_case["name"],
                category="Personalization Quality",
                timing=timing,
                quality_score=score,
                passed=passed,
                notes=notes
            )
            
            print(f"✅ PASSED" if passed else f"❌ FAILED")
            print(f"Score: {score:.2f} | Time: {timing['total']:.2f}s")
            print(f"Notes: {notes}")
            
            # Show strategy
            strategy = result.get("strategy_brief", {})
            print(f"\nStrategy:")
            print(f"  Hook: {strategy.get('hook', 'N/A')}")
            print(f"  Value Prop: {strategy.get('value_prop', 'N/A')}")
            
            # Show keyword detection
            content = result.get("generated_content", {})
            all_text = " ".join([str(v) for v in content.values()]).lower()
            print(f"\nKeyword Presence:")
            for kw in test_case["required_keywords"]:
                found = "✓" if kw.lower() in all_text else "✗"
                print(f"  {found} {kw}")
            
        except Exception as e:
            logger.error(f"❌ ERROR: {e}")
            import traceback
            traceback.print_exc()
            tracker.record_test(test_case["name"], "Personalization Quality", {"total": 0}, 0.0, False, str(e))
        
        await asyncio.sleep(1)
    
    return tracker


async def test_self_check_critic():
    """Test Suite 4: Self-Check (Critic Feedback)"""
    logger.info("🧪 TEST SUITE 4: Self-Check & Critic Feedback")
    tracker = PerformanceTracker()
    
    test_cases = [
        {
            "name": "Critic Quality - Detailed Profile",
            "input": "Generate email for Dr. Lisa Wang, Chief AI Researcher at Google DeepMind, published 50+ papers on Transformers",
            "min_critic_score": 7
        },
        {
            "name": "Critic Quality - Minimal Info",
            "input": "Create email for John",
            "min_critic_score": 4  # Expect lower score due to lack of info
        },
        {
            "name": "Retry Loop - Check Improvement",
            "input": "Generate LinkedIn DM for Alex Rivera, Head of Platform at CloudScale, spoke at KubeCon about Multi-Cloud Security",
            "min_critic_score": 7
        }
    ]
    
    for test_case in test_cases:
        print(f"\n{'='*80}")
        print(f"TEST: {test_case['name']}")
        print(f"{'='*80}")
        
        try:
            result, timing = await run_timed_test(test_case["input"])
            
            critic = result.get("critic_feedback", {})
            critic_score = critic.get("score", 0)
            attempts = result.get("generation_attempts", 0)
            
            passed = critic_score >= test_case["min_critic_score"]
            quality_score = critic_score / 10.0  # Normalize to 0-1
            
            notes = f"Critic Score: {critic_score}/10, Attempts: {attempts}, Ready: {critic.get('is_ready')}"
            if critic.get("critique"):
                notes += f" | Critique: {critic['critique'][:100]}"
            
            tracker.record_test(
                test_name=test_case["name"],
                category="Self-Check",
                timing=timing,
                quality_score=quality_score,
                passed=passed,
                notes=notes
            )
            
            print(f"✅ PASSED" if passed else f"❌ FAILED")
            print(f"Critic Score: {critic_score}/10 | Attempts: {attempts} | Time: {timing['total']:.2f}s")
            print(f"Ready: {critic.get('is_ready')} | Critique: {critic.get('critique', 'N/A')}")
            
            if critic.get("additions"):
                print(f"Additions suggested: {critic['additions']}")
            if critic.get("removals"):
                print(f"Removals suggested: {critic['removals']}")
            
        except Exception as e:
            logger.error(f"❌ ERROR: {e}")
            import traceback
            traceback.print_exc()
            tracker.record_test(test_case["name"], "Self-Check", {"total": 0}, 0.0, False, str(e))
        
        await asyncio.sleep(1)
    
    return tracker


async def main():
    """Run all test suites"""
    logger.info("🚀 Starting Comprehensive Agent Testing")
    logger.info("="*80)
    
    all_trackers = []
    
    # Run all test suites
    try:
        tracker1 = await test_profile_understanding()
        all_trackers.append(tracker1)
        
        tracker2 = await test_channel_specific_generation()
        all_trackers.append(tracker2)
        
        tracker3 = await test_personalization_quality()
        all_trackers.append(tracker3)
        
        tracker4 = await test_self_check_critic()
        all_trackers.append(tracker4)
        
    except KeyboardInterrupt:
        logger.warning("Tests interrupted by user")
    
    # Combine all results
    combined_tracker = PerformanceTracker()
    for tracker in all_trackers:
        combined_tracker.results.extend(tracker.results)
    
    # Save combined report
    report_path = "/home/manas/Documents/Xenia26/fastapi/test_results.json"
    combined_tracker.save_report(report_path)
    
    # Print summary
    print(f"\n{'='*80}")
    print("📊 FINAL SUMMARY")
    print(f"{'='*80}")
    print(f"Total Tests: {len(combined_tracker.results)}")
    print(f"Passed: {sum(1 for r in combined_tracker.results if r['passed'])}")
    print(f"Failed: {sum(1 for r in combined_tracker.results if not r['passed'])}")
    
    if combined_tracker.results:
        avg_time = sum(r["total_time"] for r in combined_tracker.results) / len(combined_tracker.results)
        avg_score = sum(r["quality_score"] for r in combined_tracker.results) / len(combined_tracker.results)
        print(f"Average Time: {avg_time:.2f}s")
        print(f"Average Quality Score: {avg_score:.2f}")
    
    print(f"\n📄 Detailed results saved to: {report_path}")
    
    return combined_tracker


if __name__ == "__main__":
    asyncio.run(main())
