import uuid


def unique_room_id() -> str:
    # Rooms live in memory for the whole test run, so every test gets its own.
    return f"test-room-{uuid.uuid4().hex[:8]}"


def test_heartbeat_returns_ok(client):
    response = client.get("/heartbeat")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_create_room_then_get_it(client):
    room_id = unique_room_id()

    create_response = client.post("/rooms/create", json={"room_id": room_id})
    get_response = client.get(f"/rooms/{room_id}")

    assert create_response.status_code == 200
    assert get_response.status_code == 200
    assert get_response.json()["id"] == room_id
    assert get_response.json()["requires_password"] is False


def test_create_room_with_password_requires_password(client):
    room_id = unique_room_id()

    client.post("/rooms/create", json={"room_id": room_id, "password": "secret"})

    assert client.get(f"/rooms/{room_id}").json()["requires_password"] is True


def test_create_room_twice_returns_400(client):
    room_id = unique_room_id()
    client.post("/rooms/create", json={"room_id": room_id})

    response = client.post("/rooms/create", json={"room_id": room_id})

    assert response.status_code == 400


def test_get_unknown_room_returns_404(client):
    response = client.get(f"/rooms/{unique_room_id()}")

    assert response.status_code == 404


def test_verify_room_with_correct_password(client):
    room_id = unique_room_id()
    client.post("/rooms/create", json={"room_id": room_id, "password": "secret"})

    response = client.post("/rooms/verify", auth=(room_id, "secret"))

    assert response.status_code == 200


def test_verify_room_with_wrong_password_returns_401(client):
    room_id = unique_room_id()
    client.post("/rooms/create", json={"room_id": room_id, "password": "secret"})

    response = client.post("/rooms/verify", auth=(room_id, "wrong"))

    assert response.status_code == 401


def test_search_without_login_returns_401(client):
    response = client.get("/search", params={"query": "queen"})

    assert response.status_code == 401
