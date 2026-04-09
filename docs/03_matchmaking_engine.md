# 03 Hybrid Matchmaking Engine

## The Philosophy
Glysmork is a Smart-Matching platform. Instead of randomly scrolling infinite profiles, a user initiates contact using highly specific search criteria: `"Someone who likes software design but hates ruby."`

To process this efficiently, the system uses two main files, `matchmaking/api/views.py` and `matchmaking/engine.py`.

## 1. Intent to AST (Abstract Syntax Tree)
When the free-form text hits the backend, the text string is immediately shuttled to `parse_intent_to_ast(intent_string)`. 
A Gemini LLM runs a rigorous few-shot prompt forcing the model to spit the text back out as a recursive JSON tree mapping Boolean Operators to `vector_concept` leaves.

Most critically, the model calculates **user sentiment**:
*   `"love"`   -> `2.2` Weight
*   `"like"`   -> `1.0` Weight
*   `"neutral"`-> `0.2` Weight
*   `"hate"`   -> `-3.0` Weight

## 2. Fast Evaluation Loop
Unlike typical AI pipelines which run Gemini repeatedly for *every* candidate comparison, Glysmork processes candidates using math.
1. The AI generated AST JSON tree is evaluated by `MatchEvaluator`.
2. The tree recursively visits the database models of all currently online candidates. 
3. If a leaf node requires `"software design"`, `engine.py` calls the Google Embedder to get the 768 float array vector for "software design".
4. It compares that vector directly against the mapped JSON Float vectors already inside the candidate's `interests_embedding` and `expertise_embedding` arrays using blazing fast Numpy Cosine Similarity.
5. The `base_similarity` (ranging from 0.0 to 1.0) is multiplied by the explicit `sentiment_weight` to establish their `final_score`.

## 3. The `use_onboarding_data` Flag
When searching, the user has the option to enforce strict baseline synergy alongside their typed search intent constraint. When `use_onboarding_data = True`:

The engine uses the searcher's *own* pre-calculated onboarding array (their cached interests) and measures it against the candidate.
The engine calculates:
`final = (strict_ast_intent_score * 0.70) + (baseline_profile_chemistry_score * 0.30)`

This yields the perfect candidate.
