"""
Shared Groq client for all LLM text generation.
Gemini is kept separately for embeddings only (groq has no embedding API).
"""
import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

GROQ_MODEL = "llama-3.3-70b-versatile"

_client = None

def get_groq_client() -> Groq:
    global _client
    if _client is None:
        _client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
    return _client


def groq_generate(prompt: str, system: str = None) -> str:
    """
    Send a single-turn prompt to Groq and return the response text.
    Raises on error so callers can handle fallbacks themselves.
    """
    client = get_groq_client()
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=messages,
        temperature=0.7,
    )
    return response.choices[0].message.content.strip()


def groq_chat(messages: list) -> str:
    """
    Send a multi-turn chat messages list to Groq and return the response text.
    Each message must be {"role": "user"|"assistant"|"system", "content": "..."}
    """
    client = get_groq_client()
    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=messages,
        temperature=0.7,
    )
    return response.choices[0].message.content.strip()
