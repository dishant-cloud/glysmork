from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_

from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import uuid

from onboarding_service.database import engine, Base, get_db
from onboarding_service.models import UserProfile, Bucket, MatchResult, AttributeRegistry
from onboarding_service.config import DEFAULT_BUCKETS
from onboarding_service.llm import identify_buckets, get_chat_response, extract_structured_data
from onboarding_service.pipeline import process_pipeline

from fastapi.middleware.cors import CORSMiddleware

# Create DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Glysmork Matchmaking Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Startup Event to seed buckets ---
@app.on_event("startup")
def startup_event():
    with Session(engine) as db:
        if db.query(Bucket).count() == 0:
            for b in DEFAULT_BUCKETS:
                new_bucket = Bucket(name=b["name"], description=b["description"], guidelines=b["guidelines"], is_default=True)
                db.add(new_bucket)
            db.commit()


# --- Pydantic Models ---
class IdentifyBucketsRequest(BaseModel):
    user_id: int
    opening_answer: str

class ChatRequest(BaseModel):
    user_id: int
    message: str
    conversation_history: List[Dict[str, str]]

class ExtractRequest(BaseModel):
    user_id: int
    full_conversation_history: List[Dict[str, str]]

# --- API Endpoints ---

@app.post("/onboarding/identify-buckets")
def api_identify_buckets(req: IdentifyBucketsRequest, db: Session = Depends(get_db)):
    """Part 3 - Bucket Identification"""
    existing = db.query(Bucket).all()
    bucket_dicts = [{"name": b.name, "description": b.description, "guidelines": b.guidelines} for b in existing]
    
    result = identify_buckets(req.opening_answer, bucket_dicts)
    
    matched_names = result.get("matched_buckets", [])
    new_buckets = result.get("new_buckets", [])
    
    matched_guidelines = []
    
    # Process existing matches
    for name in matched_names:
        b = db.query(Bucket).filter(Bucket.name == name).first()
        if b:
            matched_guidelines.append(b.guidelines)
            
    # Process dynamically created buckets
    for nb in new_buckets:
        if not db.query(Bucket).filter(Bucket.name == nb["name"]).first():
            new_b = Bucket(name=nb["name"], description=nb["description"], guidelines=nb["guidelines"], is_default=False)
            db.add(new_b)
            db.commit()
            db.refresh(new_b)
            matched_guidelines.append(new_b.guidelines)
            matched_names.append(new_b.name)
            
    return {
        "matched_buckets": matched_names,
        "guidelines": matched_guidelines
    }


@app.post("/onboarding/chat")
def api_chat(req: ChatRequest, db: Session = Depends(get_db)):
    """Part 4 - The Onboarding Conversation"""
    
    # Handle the opening question (empty message = user just arrived)
    if not req.message.strip():
        opening_question = "What brings you here today? Tell us a little about what you're looking for — there's no right or wrong answer."
        return {
            "reply": opening_question,
            "is_complete": False
        }
    
    user_buckets = db.query(Bucket).filter(Bucket.is_default == True).limit(3).all()
    guidelines = [b.guidelines for b in user_buckets]
    
    reply = get_chat_response(req.message, req.conversation_history, guidelines)
    
    return {
        "reply": reply,
        "is_complete": "CONVERSATION_COMPLETE" in reply
    }


@app.post("/onboarding/extract")
def api_extract(req: ExtractRequest, db: Session = Depends(get_db)):
    """Part 5 & 6 - Structured Extraction and Pipeline"""
    
    raw_data = extract_structured_data(req.full_conversation_history)
    
    # Process through standardizer pipeline
    processed_data = process_pipeline(raw_data, db)
    
    # Save to user_profiles table (upsert)
    profile = db.query(UserProfile).filter(UserProfile.user_id == req.user_id).first()
    
    human_summary = processed_data.get("human_summary", "")
    hard = processed_data.get("hard_filters", {})
    who_i_am = processed_data.get("who_i_am", {})
    who_i_want = processed_data.get("who_i_want", [])
    
    if profile:
        profile.human_summary = human_summary
        profile.hard_filters = hard
        profile.who_i_am = who_i_am
        profile.who_i_want = who_i_want
    else:
        profile = UserProfile(
            user_id=req.user_id,
            human_summary=human_summary,
            hard_filters=hard,
            who_i_am=who_i_am,
            who_i_want=who_i_want
        )
        db.add(profile)
        
    db.commit()
    return {"status": "success", "user_id": req.user_id, "data_saved": True}


@app.get("/match/{user_id}")
def api_match(user_id: int, db: Session = Depends(get_db)):
    """Part 8 - Matching Engine"""
    user_prof = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if not user_prof:
        raise HTTPException(status_code=404, detail="User profile not found")
        
    all_users = db.query(UserProfile).filter(UserProfile.user_id != user_id).all()
    
    matches = []
    
    for cand in all_users:
        # Step 1: Hard filters (Simplified for brevity)
        user_deals = user_prof.hard_filters.get("dealbreakers", [])
        cand_deals = cand.hard_filters.get("dealbreakers", [])
        
        cand_who_am_i_keys = cand.who_i_am.keys()
        user_who_am_i_keys = user_prof.who_i_am.keys()
        
        # If any user dealbreaker is in candidate's who_i_am => disqualify
        if any(d in cand_who_am_i_keys for d in user_deals) or any(d in user_who_am_i_keys for d in cand_deals):
            continue
            
        # Step 2: Compatibility Scoring
        def calc_score(actor, subject):
            score = 0
            for req in actor.who_i_want:
                attr = req.get("attribute")
                val = req.get("value")
                direction = req.get("direction")
                importance = req.get("importance", 0.5)
                conf = req.get("confidence", "HIGH")
                tolerance = req.get("tolerance", "FLEXIBLE")
                
                conf_multi = 1.0 if conf == "HIGH" else 0.7 if conf == "MEDIUM" else 0.4
                
                subject_val = subject.who_i_am.get(attr)
                
                is_match = False
                if direction == "WANT" and subject_val == val:
                    is_match = True
                elif direction == "AVOID" and subject_val != val:
                    is_match = True
                    
                if is_match:
                    score += importance * conf_multi * 10 
                else:
                    if tolerance == "ABSOLUTE":
                        return -999 # Disqualify
                    elif tolerance == "HARD":
                        score -= 5 * importance * conf_multi
                    elif tolerance == "SOFT":
                        score -= 2 * importance * conf_multi
            return score
            
        score_a_to_b = calc_score(user_prof, cand)
        if score_a_to_b <= -999: continue
        
        score_b_to_a = calc_score(cand, user_prof)
        if score_b_to_a <= -999: continue
        
        final_raw_score = (score_a_to_b + score_b_to_a) / 2
        # Normalize arbitrarily to 100 for this example
        final_score = min(max(final_raw_score * 5, 0), 100) 
        
        # Step 3: Zone Classification
        if final_score >= 80: zone = "IDEAL"
        elif final_score >= 60: zone = "GOOD"
        elif final_score >= 40: zone = "DECENT"
        else: continue
        
        # Save Result
        m_res = MatchResult(user_a_id=user_id, user_b_id=cand.user_id, score=final_score, zone=zone)
        db.merge(m_res)
        
        matches.append({
            "candidate_id": cand.user_id,
            "score": final_score,
            "zone": zone
        })
        
    db.commit()
    
    matches.sort(key=lambda x: x["score"], reverse=True)
    return {"user_id": user_id, "matches": matches}
