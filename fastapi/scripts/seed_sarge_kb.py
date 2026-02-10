"""
Seed ChromaDB with example outreach templates for RAG testing
"""
from ml.application.agent.knowledge import SimpleKnowledgeBase
from ml.application.sarge.schemas import ProspectProfile, StrategyBrief

def seed_data():
    kb = SimpleKnowledgeBase()
    
    # Example 1: Fintech CTO
    prospect1 = ProspectProfile(
        name="Sarah Chen",
        role="CTO",
        company="FintechFlow",
        industry="Fintech",
        detected_tone="formal"
    )
    strategy1 = StrategyBrief(
        hook="Compliance issues in 2026",
        value_prop="Zero-trust security for banks",
        pain_point="Regulatory overhead",
        recommended_tone="formal"
    )
    content1 = "Subject: Addressing Compliance Risks at FintechFlow\n\nHi Sarah, Given your role as CTO at FintechFlow, I wanted to discuss how we can automate your compliance checks..."
    
    # Example 2: Creative Director
    prospect2 = ProspectProfile(
        name="Leo Messi",
        role="Creative Director",
        company="Playmaker",
        industry="Design",
        detected_tone="casual"
    )
    strategy2 = StrategyBrief(
        hook="Dynamic branding",
        value_prop="AI for design workflows",
        pain_point="Slow turnaround",
        recommended_tone="casual"
    )
    content2 = "Hey Leo! Love the vibe at Playmaker. Ever thought about using AI to speed up your branding workflows?"

    print("🌱 Seeding ChromaDB...")
    kb.save_outreach(prospect1, strategy1, content1)
    kb.save_outreach(prospect2, strategy2, content2)
    print("✅ Seeding complete.")

if __name__ == "__main__":
    seed_data()
