import json
import re
import base64
from typing import Any

import google.generativeai as genai

from app.config import settings


def _get_model(api_key: str):
    """Configure Gemini with the given key and return a model instance."""
    if not api_key or not api_key.strip():
        raise ValueError(
            "No Gemini API key configured for this user. "
            "Please add your key in settings or during onboarding."
        )
    # google-generativeai uses a process-wide config; set it per call with the user's key
    genai.configure(api_key=api_key.strip())
    return genai.GenerativeModel(settings.gemini_model)


def validate_gemini_api_key(api_key: str) -> bool:
    """
    Lightweight check that the key works.
    Returns True if Gemini accepts it, False otherwise.
    """
    try:
        model = _get_model(api_key)
        # Tiny, cheap call to verify the key
        response = model.generate_content("Reply with exactly: ok")
        return bool(response and response.text)
    except Exception:
        return False


# ... keep TIMETABLE_EXTRACTION_PROMPT and _clean_response unchanged ...


def extract_timetable_from_image(
    file_bytes: bytes,
    mime_type: str,
    api_key: str,
) -> dict[str, Any]:
    model = _get_model(api_key)
    image_data = base64.b64encode(file_bytes).decode("utf-8")

    response = model.generate_content([
        {
            "inline_data": {
                "mime_type": mime_type,
                "data": image_data,
            }
        },
        TIMETABLE_EXTRACTION_PROMPT,
    ])

    response_text = _clean_response(response.text)

    try:
        extracted = json.loads(response_text)
    except json.JSONDecodeError as e:
        raise ValueError(
            f"Gemini returned a response that could not be parsed as JSON: {e}\n"
            f"Raw response: {response_text[:500]}"
        )

    return extracted


def extract_timetable_from_pdf(file_bytes: bytes, api_key: str) -> dict[str, Any]:
    model = _get_model(api_key)
    pdf_data = base64.b64encode(file_bytes).decode("utf-8")

    response = model.generate_content([
        {
            "inline_data": {
                "mime_type": "application/pdf",
                "data": pdf_data,
            }
        },
        TIMETABLE_EXTRACTION_PROMPT,
    ])

    response_text = _clean_response(response.text)

    try:
        extracted = json.loads(response_text)
    except json.JSONDecodeError as e:
        raise ValueError(
            f"Gemini returned a response that could not be parsed as JSON: {e}\n"
            f"Raw response: {response_text[:500]}"
        )

    return extracted