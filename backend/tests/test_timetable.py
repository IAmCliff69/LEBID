def test_timetable_entries_include_course_details(auth_client, sample_course):
	payload = {
		"course_id": sample_course["id"],
		"day_of_week": 1,
		"start_time": "08:00",
		"end_time": "09:30",
	}

	create_response = auth_client.post("/api/timetable", json=payload)
	assert create_response.status_code == 201
	created_entry = create_response.json()

	assert created_entry["course_name"] == sample_course["name"]
	assert created_entry["course_code"] == sample_course["code"]
	assert created_entry["course_color"] == sample_course["color"]

	list_response = auth_client.get("/api/timetable")
	assert list_response.status_code == 200
	assert list_response.json()[0]["course_name"] == sample_course["name"]
