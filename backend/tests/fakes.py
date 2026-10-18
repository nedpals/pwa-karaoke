import itertools

_ids = itertools.count()


class FakeClient:
    """Just enough of ConnectionClient for joining, leaving and broadcasts."""

    def __init__(self, client_type="controller"):
        self.id = f"client-{next(_ids)}"
        self.client_type = client_type
        self.room_id = None
        self.nickname = None
        self.device_id = None
        self.sent = []

    async def send_command(self, command, data):
        self.sent.append((command, data))

    async def stop_heartbeat(self):
        pass

    def received(self, command):
        return [data for sent, data in self.sent if sent == command]
