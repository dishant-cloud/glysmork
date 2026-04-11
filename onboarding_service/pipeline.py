import re
from Levenshtein import distance as levenshtein_distance
from sqlalchemy.orm import Session
from onboarding_service.models import AttributeRegistry
from onboarding_service.config import COMMON_SYNONYMS

def standardize_string(val: str) -> str:
    """Basic standardizer: uppercase and replace spaces with underscores."""
    if not isinstance(val, str):
        return val
    # Strip modifiers (simple version)
    val = val.upper()
    modifiers = ["VERY ", "HIGHLY ", "EXTREMELY ", "SLIGHTLY ", "SOMEWHAT "]
    for mod in modifiers:
        if val.startswith(mod):
            val = val.replace(mod, "")
            
    # American English simple replacements
    replacements = {
        "ORGANISED": "ORGANIZED",
        "COLOUR": "COLOR",
        "FAVOURITE": "FAVORITE"
    }
    for uk, us in replacements.items():
        val = val.replace(uk, us)
        
    # Convert to SCREAMING_SNAKE_CASE
    val = re.sub(r'[\s\-]+', '_', val.strip())
    
    # Apply synonym map
    if val in COMMON_SYNONYMS:
        val = COMMON_SYNONYMS[val]
        
    return val

def process_pipeline(parsed_data: dict, db: Session) -> dict:
    """Part 6: Backend Standardization Pipeline."""
    
    # 1. Standardize who_i_am keys and values
    standardized_who_i_am = {}
    for k, v in parsed_data.get("who_i_am", {}).items():
        std_k = standardize_string(k)
        std_v = standardize_string(v) if isinstance(v, str) else v
        
        # Levenshtein distance check against attribute_registry
        registry_matches = db.query(AttributeRegistry).filter(AttributeRegistry.attribute_name == std_k).all()
        matched = False
        for reg in registry_matches:
            if isinstance(std_v, str) and levenshtein_distance(std_v, reg.canonical_value) <= 2:
                std_v = reg.canonical_value
                reg.usage_count += 1
                db.commit()
                matched = True
                break
                
        if not matched and isinstance(std_v, str):
            # Create new registry entry
            new_reg = AttributeRegistry(attribute_name=std_k, canonical_value=std_v)
            db.add(new_reg)
            db.commit()
            
        standardized_who_i_am[std_k] = std_v
        
    parsed_data["who_i_am"] = standardized_who_i_am
    
    # 2. Standardize who_i_want
    standardized_who_i_want = []
    for req in parsed_data.get("who_i_want", []):
        std_attr = standardize_string(req.get("attribute", ""))
        std_val = standardize_string(req.get("value", "")) if isinstance(req.get("value"), str) else req.get("value")
        
        req["attribute"] = std_attr
        req["value"] = std_val
        standardized_who_i_want.append(req)
        
    parsed_data["who_i_want"] = standardized_who_i_want
    
    # 3. Standardize dealbreakers
    if "hard_filters" in parsed_data:
        deals = parsed_data["hard_filters"].get("dealbreakers") or []
        parsed_data["hard_filters"]["dealbreakers"] = [standardize_string(d) for d in deals]
        
    return parsed_data
