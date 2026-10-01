import json
import re
import base64
from typing import Any

import google.generativeai as genai

from app.config import settings

# Configure the Gemini client with our API key
genai.configure(api_key=settings.gemini_api_key)


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


def extract_timetable_from_image(file_bytes: bytes, mime_type: str) -> dict[str, Any]:
    """
    Sends a timetable image to Gemini Vision and extracts structured data.

    Args:
        file_bytes: The raw bytes of the uploaded file
        mime_type: The MIME type of the file (e.g. "image/jpeg", "image/png")

    Returns:
        A dictionary containing:
        - entries: list of extracted timetable entries
        - extraction_notes: any notes from Gemini about the extraction

    Raises:
        ValueError: if the response cannot be parsed as valid JSON
        Exception: if the Gemini API call fails
    """
    model = genai.GenerativeModel(settings.gemini_model)

    # Encode the file as base64 for the API
    image_data = base64.b64encode(file_bytes).decode("utf-8")

    # Send the image and prompt to Gemini
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


def extract_timetable_from_pdf(file_bytes: bytes) -> dict[str, Any]:
    """
    Sends a timetable PDF to Gemini and extracts structured data.
    Gemini 1.5 Flash supports PDF input natively.
    """
    model = genai.GenerativeModel(settings.gemini_model)

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