from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models.user import User
from app.schemas.ai import ChatRequest, ChatResponse, Recommendation
from app.services.context_builder import build_student_context
from app.services.ai_planner import get_ai_response
from app.config import settings

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
def chat_with_ai(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Send a message to the AI planning assistant.

    The AI has access to the student's full academic context:
    courses, timetable, assignments, exams, study sessions, and events.

    Example messages:
    - "I have an exam in two weeks. How should I prepare?"
    - "I missed my study session yesterday. What should I do?"
    - "Help me plan my assignments for next week."
    - "I have too much to do this week. Can you help me reorganize?"
    - "When should I study for my COE 353 exam?"

    The AI returns a conversational response plus specific
    recommendations the student can choose to act on.
    """
    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is not configured. Please set the GEMINI_API_KEY.",
        )

    # Build the student's full academic context
    context = build_student_context(current_user, db)

    # Get AI response
    try:
        result = get_ai_response(
            student_message=payload.message,
            context=context,
            conversation_history=payload.conversation_history,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI service error: {str(e)}",
        )

    # Parse recommendations safely
    recommendations = []
    for rec in result.get("recommendations", []):
        try:
            recommendations.append(Recommendation(
                type=rec.get("type", "general_advice"),
                title=rec.get("title", ""),
                description=rec.get("description", ""),
                data=rec.get("data", {}),
            ))
        except Exception:
            continue

    return ChatResponse(
        message=result.get("message", "I was unable to generate a response. Please try again."),
        recommendations=recommendations,
        insights=result.get("insights", []),
    )


@router.get("/context")
def get_student_context(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns the full academic context that gets sent to the AI.

    This endpoint is useful for:
    - Debugging what the AI can see
    - Verifying that all your data is being picked up correctly
    - Understanding what context the AI uses for recommendations
    """
    context = build_student_context(current_user, db)
    return context