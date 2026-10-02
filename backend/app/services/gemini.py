import json
import re
from typing import Any

from google import genai
from google.genai import errors, types

from app.config import settings

# ---------------------------------------------------------------------------
# IMPORTANT (one user -> one Gemini key):
# Every function here receives the CURRENT user's API key and builds its OWN
# client from it. We never store a key in a global variable, so two students
# using Lebid at the same time can never end up using each other's key.
# ---------------------------------------------------------------------------


# The extraction prompt tells Gemini exactly what we need
TIMETABLE_EXTRACTION_PROMPT = """
You are a timetable extraction assistant. Analyze the provided timetable image and extract all class schedule information.

Extract every class entry you can find and return the data as a JSON object with this exact structure:

{
  "entries": [
    {
      "course_name": "Full course name as shown in the timetable",
      "course_code": "Course code if visible, e.g. COE 354, or null if not shown",
      "day_of_week": 0,
      "start_time": "08:00",
      "end_time": "10:00",
      "venue": "Room or location if shown, or null if not visible",
      "lecturer": "Lecturer name if shown, or null if not visible",
      "class_type": "lecture"
    }
  ],
  "extraction_notes": "Any notes about unclear entries, missing information, or parts of the timetable you could not read clearly"
}

Important rules:
- day_of_week must be an integer: 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday
- start_time and end_time must be in 24-hour format: "HH:MM"
- class_type should be one of: lecture, tutorial, lab, practical, seminar, other
- If you cannot determine a value, use null
- Return ONLY the JSON object, no other text before or after it
- If the image is not a timetable or cannot be read, return: {"entries": [], "extraction_notes": "Could not extract timetable data. Reason: <explain why>"}
"""


def _clean_response(text: str) -> str:
    """
    Cleans the raw text from Gemini before JSON parsing.

    Removes:
    1. Markdown code fences (```json ... ```)
    2. Invisible control characters (U+0000–U+001F except tab, newline,
       carriage return) that break JSON parsing but can appear in
       Gemini's output when it copies text from images.
    """
    text = text.strip()

    # Remove markdown code fences if present
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1])

    # Strip control characters that are invalid inside JSON strings.
    # Keep \t (0x09), \n (0x0A), \r (0x0D) — all others in 0x00–0x1F are illegal.
    text = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F]", "", text)

    return text.strip()


def _make_client(api_key: str) -> genai.Client:
    """Create a Gemini client that belongs to ONE user's key (never shared)."""
    if not api_key or not api_key.strip():
        raise ValueError(
            "No Gemini API key configured for this user. "
            "Please add your key in settings or during onboarding."
        )
    return genai.Client(api_key=api_key.strip())


def _is_key_rejection(error: errors.ClientError) -> bool:
    """True if Google said the API key itself is wrong, expired or revoked."""
    message = str(error.message or "").lower()
    return error.code in (401, 403) or "api key" in message


def generate_text(
    api_key: str,
    contents: Any,
    system_instruction: str | None = None,
    expect_json: bool = False,
) -> str:
    """
    Sends one request to Gemini using the given user's key and returns the
    raw text of the answer. Used by both the timetable import and the AI planner.
    """
    client = _make_client(api_key)

    config = types.GenerateContentConfig(
        system_instruction=system_instruction,
        response_mime_type="application/json" if expect_json else None,
    )

    try:
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=contents,
            config=config,
        )
    except errors.ClientError as e:
        # A wrong/revoked key gets a clear message. Everything else
        # (rate limits, bad requests) is passed up unchanged so the routers
        # can handle it as they already do.
        if _is_key_rejection(e):
            raise ValueError(
                "Your Gemini API key was rejected by Google. "
                "Please check it and update it in your settings."
            ) from e
        raise

    if not response.text:
        raise ValueError(
            "Gemini returned an empty response. Please try again."
        )
    return response.text


def validate_gemini_api_key(api_key: str) -> bool:
    """
    Checks that Google accepts this key. Returns True or False.
    We list the available models, which proves the key works without
    spending any of the student's quota on a generation request.
    """
    try:
        client = _make_client(api_key)
        next(iter(client.models.list()), None)
        return True
    except Exception:
        return False


def _extract_timetable(file_bytes: bytes, mime_type: str, api_key: str) -> dict[str, Any]:
    """Shared by the image and PDF extractors: file + prompt -> parsed JSON."""
    file_part = types.Part.from_bytes(data=file_bytes, mime_type=mime_type)

    raw_text = generate_text(
        api_key,
        contents=[file_part, TIMETABLE_EXTRACTION_PROMPT],
        expect_json=True,
    )
    response_text = _clean_response(raw_text)

    try:
        return json.loads(response_text)
    except json.JSONDecodeError as e:
        raise ValueError(
            f"Gemini returned a response that could not be parsed as JSON: {e}\n"
            f"Raw response: {response_text[:500]}"
        )


def extract_timetable_from_image(
    file_bytes: bytes, mime_type: str, api_key: str
) -> dict[str, Any]:
    """Sends a timetable image to Gemini using the user's key."""
    return _extract_timetable(file_bytes, mime_type, api_key)


def extract_timetable_from_pdf(file_bytes: bytes, api_key: str) -> dict[str, Any]:
    """Sends a timetable PDF to Gemini using the user's key."""
    return _extract_timetable(file_bytes, "application/pdf", api_key)