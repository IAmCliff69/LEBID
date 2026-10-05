URL = "/api/users/me/study-preferences"

VALID = {
    "study_times": ["evening", "morning", "morning"],
    "study_days": [4, 0, 2, 2],
    "session_length_minutes": 240,
    "break_preference": "long",
}


def test_get_returns_null_before_anything_is_saved(auth_client):
    response = auth_client.get(URL)
    assert response.status_code == 200
    assert response.json() is None


def test_save_then_get(auth_client):
    saved = auth_client.put(URL, json=VALID)
    assert saved.status_code == 200
    # duplicates removed, days sorted, times in a fixed order
    assert saved.json()["study_days"] == [0, 2, 4]
    assert saved.json()["study_times"] == ["morning", "evening"]

    loaded = auth_client.get(URL).json()
    assert loaded["study_times"] == ["morning", "evening"]
    assert loaded["session_length_minutes"] == 240
    assert loaded["break_preference"] == "long"


def test_saving_again_replaces_the_old_values(auth_client):
    auth_client.put(URL, json=VALID)
    auth_client.put(URL, json={**VALID, "study_times": ["afternoon"], "study_days": [1]})

    loaded = auth_client.get(URL).json()
    assert loaded["study_times"] == ["afternoon"]
    assert loaded["study_days"] == [1]


def test_invalid_values_are_rejected(auth_client):
    bad_payloads = [
        {**VALID, "study_days": []},
        {**VALID, "study_days": [7]},
        {**VALID, "study_times": []},
        {**VALID, "study_times": ["midnight"]},
        {**VALID, "break_preference": "none"},
        {**VALID, "session_length_minutes": 5},
        {**VALID, "session_length_minutes": 300},
    ]
    for payload in bad_payloads:
        assert auth_client.put(URL, json=payload).status_code == 422


def test_requires_login(client):
    assert client.get(URL).status_code in (401, 403)


def test_one_student_cannot_see_anothers_preferences(auth_client, auth_client_b):
    auth_client.put(URL, json=VALID)
    assert auth_client_b.get(URL).json() is None