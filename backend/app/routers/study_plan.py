from fastapi import APIRouter, Depends, HTTPException, status
from google.genai import errors as genai_errors
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models.study_preferences import StudyPreferences
from app.models.timetable_import import TimetableImport
from app.models.user import User
from app.schemas.study_plan import (
    AdjustedStudyPlan,
    AdjustStudyPlanRequest,
    GeneratedStudyPlan,
    GenerateStudyPlanRequest,
    ActivatedPlan,
    ActivatePlanRequest,
)
from app.services.study_plan_adjuster import adjust_study_plan
from app.services.study_plan_activation import activate_plan
from app.services.study_planner import (
    PlanGenerationError,
    build_study_plan,
    classes_from_extraction,
    classes_from_saved_timetable,
)

router = APIRouter()


@router.post("/generate", response_model=GeneratedStudyPlan)
def generate_study_plan(
    payload: GenerateStudyPlanRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Proposes a weekly study plan around the student's classes and study
    preferences, using the student's own Gemini key.

    Nothing is saved. The student reviews the plan first, then adds venues
    and activates it in a later step.
    """
    if not current_user.gemini_api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please add your Gemini API key before building a study plan.",
        )

    preferences = (
        db.query(StudyPreferences)
        .filter(StudyPreferences.user_id == current_user.id)
        .first()
    )
    if preferences is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please save your study preferences before building a study plan.",
        )

    # Where do the classes come from?
    if payload.import_id:
        # Scoped to the logged-in student so nobody can read another
        # student's import by guessing an id.
        import_session = (
            db.query(TimetableImport)
            .filter(
                TimetableImport.id == payload.import_id,
                TimetableImport.user_id == current_user.id,
            )
            .first()
        )
        if import_session is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Timetable import not found.",
            )
        if import_session.status not in ("extracted", "confirmed") or not import_session.extracted_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This timetable has not been processed yet.",
            )
        classes, skipped = classes_from_extraction(import_session.extracted_data)
    else:
        classes, skipped = classes_from_saved_timetable(db, current_user.id)

    if not classes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No classes were found in your timetable, so there is nothing to plan around yet.",
        )

    try:
        return build_study_plan(classes, skipped, preferences, current_user.gemini_api_key)
    except ValueError as e:
        # Problems the student can fix (no free time, rejected API key, ...)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PlanGenerationError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))
    except genai_errors.ClientError as e:
        if e.code == 429:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="The AI service is busy right now. Please wait a minute and try again.",
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI service could not build your plan. Please try again.",
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI service could not build your plan. Please try again.",
        )

@router.post("/adjust", response_model=AdjustedStudyPlan)
def adjust_plan(
    payload: AdjustStudyPlanRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Changes the student's draft study plan according to a request in plain
    words, using the student's own Gemini key. Nothing is saved here: the
    updated plan is returned and the student keeps reviewing it.
    """
    if not current_user.gemini_api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please add your Gemini API key before changing your study plan.",
        )

    preferences = (
        db.query(StudyPreferences)
        .filter(StudyPreferences.user_id == current_user.id)
        .first()
    )
    if preferences is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please save your study preferences before changing your study plan.",
        )

    # The classes the plan must respect (same sources as plan generation)
    if payload.import_id:
        import_session = (
            db.query(TimetableImport)
            .filter(
                TimetableImport.id == payload.import_id,
                TimetableImport.user_id == current_user.id,
            )
            .first()
        )
        if import_session is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Timetable import not found.",
            )
        if import_session.status not in ("extracted", "confirmed") or not import_session.extracted_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This timetable has not been processed yet.",
            )
        classes, _skipped = classes_from_extraction(import_session.extracted_data)
    else:
        classes, _skipped = classes_from_saved_timetable(db, current_user.id)

    if not classes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No classes were found in your timetable, so there is nothing to plan around yet.",
        )

    try:
        return adjust_study_plan(
            payload.sessions,
            classes,
            preferences,
            payload.instruction,
            current_user.gemini_api_key,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except PlanGenerationError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))
    except genai_errors.ClientError as e:
        if e.code == 429:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="The AI service is busy right now. Please wait a minute and try again.",
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI service could not change your plan. Please try again.",
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI service could not change your plan. Please try again.",
        ) 

@router.post("/activate", response_model=ActivatedPlan)
def activate(
    payload: ActivatePlanRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Starts using the reviewed plan: saves the student's courses, weekly
    classes and study sessions (each with a venue) in one step.

    Either everything is saved, or nothing is.
    """
    # Scoped to the logged-in student
    import_session = (
        db.query(TimetableImport)
        .filter(
            TimetableImport.id == payload.import_id,
            TimetableImport.user_id == current_user.id,
        )
        .first()
    )
    if import_session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Timetable import not found.",
        )

    if import_session.status == "confirmed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This plan has already been activated.",
        )

    if import_session.status != "extracted" or not import_session.extracted_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This timetable has not been processed yet.",
        )

    classes, _skipped = classes_from_extraction(import_session.extracted_data)
    if not classes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No classes were found in your timetable, so there is nothing to activate.",
        )

    try:
        result = activate_plan(
            db, current_user, import_session, classes, payload.sessions, payload.weeks
        )
        current_user.onboarding_completed = True 
        db.commit()
        return result
    except ValueError as e:
        # Problems with the plan itself (nothing was saved)
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="We couldn't save your plan. Nothing was changed. Please try again.",
        )    