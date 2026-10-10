from app.models.user import User
from app.models.course import Course
from app.models.timetable import TimetableEntry
from app.models.timetable_import import TimetableImport
from app.models.task import Task
from app.models.assignment import Assignment
from app.models.exam import Exam
from app.models.event import Event
from app.models.study_session import StudySession
from app.models.notification import Notification
from app.models.study_preferences import StudyPreferences
from app.models.user_avatar import UserAvatar
from app.models.notification_preferences import NotificationPreferences
from app.models.lecture_occurrence import LectureOccurrence

__all__ = [
    "User", "Course", "TimetableEntry", "TimetableImport",
    "Task", "Assignment", "Exam", "Event", "StudySession", "Notification",
    "StudyPreferences", "UserAvatar", "NotificationPreferences",
    "LectureOccurrence",
]