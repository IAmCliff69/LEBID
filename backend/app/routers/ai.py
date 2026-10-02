from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models.user import User
from app.schemas.ai import ChatRequest, ChatResponse, Recommendation
from app.services.context_builder import build_student_context
from app.services.ai_planner import get_ai_response

router = APIRouter()


@router.get("/context")
def get_ai_context(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return the current student's academic context used by the AI planner.
    """
    try:
        context = build_student_context(current_user, db)
        return context
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to build AI context: {str(e)}",
        )


@router.post("/chat", response_model=ChatResponse)
def chat_with_ai(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Send a message to the AI planning assistant.

    Uses the current user's personal Gemini API key
    (one user → one key).
    """
    if not current_user.gemini_api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please add your Gemini API key to use the AI assistant.",
        )

    context = build_student_context(current_user, db)

    try:
        result = get_ai_response(
            student_message=payload.message,
            context=context,
            api_key=current_user.gemini_api_key,
            conversation_history=payload.conversation_history,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI service error: {str(e)}",
        )

    recommendations = []

    for rec in result.get("recommendations", []):
        try:
            recommendations.append(
                Recommendation(
                    type=rec.get("type", "general_advice"),
                    title=rec.get("title", ""),
                    description=rec.get("description", ""),
                    data=rec.get("data", {}),
                )
            )
        except Exception:
            continue

    return ChatResponse(
        message=result.get(
            "message",
            "I was unable to generate a response. Please try again.",
        ),
        recommendations=recommendations,
        insights=result.get("insights", []),
    )