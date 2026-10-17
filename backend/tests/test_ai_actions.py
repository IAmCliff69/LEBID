import json
from datetime import date, timedelta
from unittest import mock


DAY = date.today() + timedelta(days=3)
OTHER_DAY = date.today() + timedelta(days=4)


def _add_key(client):
    with mock.patch("app.routers.users.validate_gemini_api_key", return_value=True):
        response = client.post("/api/users/me/gemini-key", json={"api_key": "A" * 30})
    assert response.status_code == 200


def _chat(client, actions, message="Here you go."):
    """Sends a chat message while the AI 'answers' with the given actions."""
    reply = json.dumps({"message": message, "recommendations": [], "actions": actions})
    with mock.patch("app.services.ai_planner.generate_text", return_value=reply):
        return client.post("/api/ai/chat", json={"message": "please change things"})


def _session(client, course_id, start="19:00", end="20:00", day=DAY):
    response = client.post("/api/study-sessions", json={
        "course_id": course_id,
        "session_date": str(day),
        "start_time": start,
        "end_time": end,
        "venue": "Library",
        "topic": "Pointers",
    })
    assert response.status_code == 201, response.text
    return response.json()


def _task(client, title="Lab report"):
    response = client.post("/api/tasks", json={"title": title})
    assert response.status_code == 201, response.text
    return response.json()


def test_a_valid_move_becomes_an_action(auth_client, sample_course):
    _add_key(auth_client)
    session = _session(auth_client, sample_course["id"])

    response = _chat(auth_client, [{
        "action": "update", "entity": "study_session", "id": session["id"],
        "title": "Move Pointers", "description": "A day later.",
        "payload": {"session_date": str(OTHER_DAY)},
    }])

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["action_warnings"] == []
    assert len(body["actions"]) == 1
    action = body["actions"][0]
    assert action["id"] == session["id"]
    assert action["payload"] == {"session_date": str(OTHER_DAY)}
    assert action["previous"] == {"session_date": str(DAY)}
    assert "Study session" in action["target"]
    assert action["key"]


def test_nothing_is_changed_by_the_chat_itself(auth_client, sample_course):
    _add_key(auth_client)
    session = _session(auth_client, sample_course["id"])
    _chat(auth_client, [{
        "action": "delete", "entity": "study_session", "id": session["id"],
        "title": "Delete it", "description": "x",
    }])
    # the student has not pressed Apply, so the session is still there
    ids = [item["id"] for item in auth_client.get("/api/study-sessions").json()]
    assert session["id"] in ids


def test_another_students_item_is_refused(auth_client, auth_client_b):
    _add_key(auth_client)
    others_task = _task(auth_client_b, "Private task")

    response = _chat(auth_client, [{
        "action": "delete", "entity": "task", "id": others_task["id"],
        "title": "Delete task", "description": "x",
    }])

    assert response.status_code == 200
    assert response.json()["actions"] == []
    assert len(response.json()["action_warnings"]) == 1


def test_another_students_course_is_refused(auth_client, auth_client_b):
    _add_key(auth_client)
    others_course = auth_client_b.post("/api/courses", json={"name": "Secret"}).json()

    response = _chat(auth_client, [{
        "action": "create", "entity": "task",
        "title": "Add task", "description": "x",
        "payload": {"title": "Sneaky", "course_id": others_course["id"]},
    }])

    assert response.json()["actions"] == []
    assert "course" in response.json()["action_warnings"][0]


def test_invalid_details_are_left_out(auth_client):
    _add_key(auth_client)
    response = _chat(auth_client, [{
        "action": "create", "entity": "task",
        "title": "Add task", "description": "x",
        "payload": {"title": "Read", "priority": "super-duper"},
    }])
    assert response.json()["actions"] == []
    assert len(response.json()["action_warnings"]) == 1


def test_a_clashing_session_is_left_out(auth_client, sample_course):
    _add_key(auth_client)
    _session(auth_client, sample_course["id"], "19:00", "20:00")

    response = _chat(auth_client, [{
        "action": "create", "entity": "study_session",
        "title": "Add session", "description": "x",
        "payload": {
            "course_id": sample_course["id"], "session_date": str(DAY),
            "start_time": "19:30", "end_time": "20:30", "venue": "Hostel",
        },
    }])

    assert response.json()["actions"] == []
    assert "clash" in response.json()["action_warnings"][0]


def test_a_session_in_the_past_is_left_out(auth_client, sample_course):
    _add_key(auth_client)
    yesterday = date.today() - timedelta(days=1)
    response = _chat(auth_client, [{
        "action": "create", "entity": "study_session",
        "title": "Add session", "description": "x",
        "payload": {
            "course_id": sample_course["id"], "session_date": str(yesterday),
            "start_time": "10:00", "end_time": "11:00", "venue": "Library",
        },
    }])
    assert response.json()["actions"] == []
    assert "passed" in response.json()["action_warnings"][0]


def test_deleting_keeps_what_undo_needs(auth_client):
    _add_key(auth_client)
    task = _task(auth_client, "Lab report")

    response = _chat(auth_client, [{
        "action": "delete", "entity": "task", "id": task["id"],
        "title": "Delete task", "description": "x",
    }])

    action = response.json()["actions"][0]
    assert action["target"] == "Lab report"
    assert action["previous"]["title"] == "Lab report"


def test_marking_a_task_complete_remembers_the_old_status(auth_client):
    _add_key(auth_client)
    task = _task(auth_client)

    response = _chat(auth_client, [{
        "action": "update", "entity": "task", "id": task["id"],
        "title": "Complete task", "description": "x",
        "payload": {"status": "completed"},
    }])

    action = response.json()["actions"][0]
    assert action["payload"] == {"status": "completed"}
    assert action["previous"] == {"status": "not_started"}


def test_the_ai_cannot_set_repeat_or_ai_generated(auth_client, sample_course):
    _add_key(auth_client)
    response = _chat(auth_client, [{
        "action": "create", "entity": "study_session",
        "title": "Add session", "description": "x",
        "payload": {
            "course_id": sample_course["id"], "session_date": str(DAY),
            "start_time": "15:00", "end_time": "16:00", "venue": "Library",
            "repeat_weeks": 12, "is_ai_generated": True,
        },
    }])

    payload = response.json()["actions"][0]["payload"]
    assert "repeat_weeks" not in payload
    assert "is_ai_generated" not in payload


def test_no_more_than_ten_actions_are_shown(auth_client):
    _add_key(auth_client)
    many = [{
        "action": "create", "entity": "task",
        "title": f"Task {i}", "description": "x",
        "payload": {"title": f"Task {i}"},
    } for i in range(12)]

    response = _chat(auth_client, many)

    assert len(response.json()["actions"]) == 10
    assert len(response.json()["action_warnings"]) == 1


def test_a_reply_without_actions_still_works(auth_client):
    _add_key(auth_client)
    response = _chat(auth_client, [])
    assert response.status_code == 200
    assert response.json()["actions"] == []
    assert response.json()["action_warnings"] == []

def test_two_suggestions_for_the_same_slot_do_not_both_survive(
    auth_client, sample_course
):
    _add_key(auth_client)

    def new_session(venue):
        return {
            "action": "create", "entity": "study_session",
            "title": f"Add {venue}", "description": "x",
            "payload": {
                "course_id": sample_course["id"], "session_date": str(DAY),
                "start_time": "15:00", "end_time": "16:00", "venue": venue,
            },
        }

    response = _chat(auth_client, [new_session("Library"), new_session("Hostel")])

    assert len(response.json()["actions"]) == 1
    assert "another change" in response.json()["action_warnings"][0]    