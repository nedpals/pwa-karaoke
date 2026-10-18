import uuid


def unique_room_id() -> str:
    return f"test-room-{uuid.uuid4().hex[:8]}"


def test_heartbeat_returns_ok(client):
    response = client.get("/heartbeat")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_heartbeat_reports_no_lan_ip_when_unset(client, monkeypatch):
    for value in ("", "127.0.0.1"):
        monkeypatch.setattr("main.config.KARAOKE_LAN_IP", value)

        assert client.get("/heartbeat").json()["lan_ip"] is None


def test_heartbeat_reports_configured_lan_ip(client, monkeypatch):
    monkeypatch.setattr("main.config.KARAOKE_LAN_IP", "192.168.1.20")

    assert client.get("/heartbeat").json()["lan_ip"] == "192.168.1.20"


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


def test_auth_errors_do_not_trigger_the_browser_sign_in_dialog(client):
    room_id = unique_room_id()
    client.post("/rooms/create", json={"room_id": room_id, "password": "secret"})

    responses = [
        client.post("/rooms/verify", auth=(room_id, "wrong")),
        client.post("/rooms/verify", auth=(unique_room_id(), "")),
        client.get("/search", params={"query": "queen"}),
    ]

    for response in responses:
        assert response.status_code == 401
        assert "www-authenticate" not in response.headers
