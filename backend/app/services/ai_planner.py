import json
from typing import Any

from app.services.gemini import generate_text

# No global API key here. Each call uses the current user's personal Gemini key.


SYSTEM_PROMPT = """
You are Lebid's AI academic planning assistant. You help university students
organize their academic lives by analyzing their schedule and workload.

You have access to the student's complete academic context including their
courses, timetable, assignments, exams, study sessions, and events.

Your role is to:
1. Answer planning questions using the student's actual data
2. Suggest realistic study sessions and schedule adjustments
3. Warn about upcoming deadlines and heavy workload periods
4. Help reschedule missed study sessions
5. Recommend exam preparation strategies

Important rules you must follow:
- Always base recommendations on the student's actual data provided
- Never suggest study sessions during existing timetable classes or events
- Respect fixed and protected commitments
- Be realistic about study durations — avoid overloading the student
- Always explain your reasoning clearly
- When suggesting schedule changes, be specific about dates and times
- Never make changes silently — always present them as recommendations
- If important information is missing, ask for clarification

Response format:
Always respond with a JSON object in this exact structure:
{
  "message": "Your conversational response to the student",
  "recommendations": [
    {
      "type": "add_study_session | reschedule_session | adjust_workload | general_advice",
      "title": "Short title for this recommendation",
      "description": "Detailed explanation of what to do and why",
      "data": {
        // For add_study_session: course_id, suggested_date, suggested_start_time, suggested_end_time, venue, topic
        // For reschedule_session: session_id, suggested_date, suggested_start_time, suggested_end_time
        // For adjust_workload: description of the adjustment
        // For general_advice: any relevant details
      }
    }
  ],
  "insights": [
    "Any important observations about the student's schedule or workload"
  ]
}

If there are no specific recommendations, return an empty recommendations array.
Always return valid JSON. Never include text outside the JSON structure.
"""


def get_ai_response(
    student_message: str,
    context: dict[str, Any],
    api_key: str,
    conversation_history: list[dict] | None = None,
) -> dict[str, Any]:
    """
    Sends the student's message and their full academic context to Gemini
    (using THEIR key) and returns structured planning recommendations.
    """
    context_block = f"""
STUDENT ACADEMIC CONTEXT:
{json.dumps(context, indent=2)}

STUDENT MESSAGE:
{student_message}
"""

    # Earlier messages first, then the new message with the context attached.
    messages = []
    if conversation_history:
        for msg in conversation_history:
            messages.append({
                "role": msg["role"],
                "parts": [{"text": msg["content"]}],
            })

    messages.append({
        "role": "user",
        "parts": [{"text": context_block}],
    })

    response_text = generate_text(
        api_key,
        contents=messages,
        system_instruction=SYSTEM_PROMPT,
        expect_json=True,
    ).strip()

    if response_text.startswith("```"):
        lines = response_text.split("\n")
        response_text = "\n".join(lines[1:-1])

    try:
        result = json.loads(response_text)
    except json.JSONDecodeError:
        result = {
            "message": response_text,
            "recommendations": [],
            "insights": [],
        }

    return result