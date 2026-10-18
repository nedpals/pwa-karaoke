# Contributing to PWA Karaoke

Welcome, and thank you for your interest in contributing!

PWA Karaoke turns any device into a karaoke machine. One device is a **display** (a TV or laptop that plays the video), and phones are **controllers** (they search for songs and control playback). The backend is Python (FastAPI) and the frontend is React with TypeScript. The browser uses HTTP for search and room APIs, and a WebSocket for live room updates and playback commands.

You do not need to build a big feature. Small contributions are very welcome: fixing a typo in the docs, adding a test, polishing a UI component. If this is your first open-source pull request (PR), you are in the right place.

## Before you start

You need:

- A [GitHub](https://github.com) account
- [Git](https://git-scm.com/downloads) (on Windows, install Git for Windows and use Git Bash or PowerShell)
- [uv](https://docs.astral.sh/uv/getting-started/installation/), which can install the project's pinned Python version (3.12)
- Node.js 22 (the version used in CI; Node.js 20 or newer is supported by the app)

Check your versions:

```bash
git --version
uv --version
node --version
```

If you cannot get Python or Node working, use the dev container instead. Open the repo in VS Code with the Dev Containers extension, or start a GitHub Codespace from your fork. The config is in `.devcontainer/devcontainer.json`; it installs uv, Python dependencies, and Node dependencies when the container is created.

## Workflow

1. **Pick and claim an issue.** Comment on the issue ("I'd like to work on this") before you start, so two people do not pick the same one. Wait for a maintainer to say yes.
2. **Fork** the repo: click **Fork** at the top of [github.com/nedpals/pwa-karaoke](https://github.com/nedpals/pwa-karaoke).
3. **Clone your fork** (replace `YOUR-USERNAME`):

   ```bash
   git clone https://github.com/YOUR-USERNAME/pwa-karaoke.git
   cd pwa-karaoke
   ```

4. **Add the original repo as `upstream`** so you can pull in new changes:

   ```bash
   git remote add upstream https://github.com/nedpals/pwa-karaoke.git
   git remote -v
   ```

5. **Sync your fork's `master` branch** with the original repo before starting work:

   ```bash
   git switch master
   git fetch upstream
   git merge --ff-only upstream/master
   git push origin master
   ```

   This updates local `master` from `upstream/master` and pushes the same update to `origin` (your fork). If the fast-forward fails, your local `master` has diverged; resolve that before creating a feature branch.

6. **Set the app up** by following the [Local development section of the README](README.md#local-development). Short version: one terminal runs the backend (`uv sync` then `uv run python main.py` inside `backend/`), another runs the frontend (`npm ci` then `npm run dev` inside `frontend/`), and you open `http://localhost:5173`. The README has separate Windows (PowerShell) commands. You do not need to run the app to work on docs or backend tests.
7. **Create a branch from the updated `master`.** Never work on `master`. Name the branch after the kind of change:

   | Prefix | Use for | Example |
   | --- | --- | --- |
   | `fix/` | Bug fixes | `fix/queue-empty-crash` |
   | `feat/` | New features | `feat/volume-slider` |
   | `docs/` | Documentation | `docs/windows-setup-tips` |
   | `test/` | Tests | `test/room-autoplay` |

   ```bash
   git switch -c docs/windows-setup-tips
   ```

8. **Make your change**, then [run the checks](#running-checks-locally).
9. **Commit** with a [conventional message](#commit-messages):

   ```bash
   git add path/to/changed-file
   git commit -m "docs: add Windows setup tips"
   ```

10. **Push to your fork**:

   ```bash
   git push -u origin docs/windows-setup-tips
   ```

11. **Open a PR.** GitHub shows a "Compare & pull request" button on your fork. Make sure the base is `nedpals/pwa-karaoke` and branch `master`. See the [PR checklist](#pr-checklist).

### If `master` moves while you work

Other people's PRs get merged. To bring your branch up to date:

```bash
git fetch upstream
git switch your-branch-name
git rebase upstream/master
```

If you would rather not rebase, `git merge upstream/master` works too. If Git reports conflicts, open the files it lists, keep the right lines, remove the `<<<<<<<` markers, then run `git add <file>` and `git rebase --continue` (or commit, if you merged). After a rebase, push with `git push --force-with-lease`. Ask on your PR if you get stuck. Conflicts are normal and not your fault.

## Running checks locally

CI (`.github/workflows/ci.yml`) runs the backend tests and frontend lint and build on every push and pull request. Run the relevant commands before you push.

**Backend**, from the `backend/` folder:

```bash
uv sync
uv run pytest
```

To run a single test:

```bash
uv run pytest tests/test_queue.py::test_enqueue_adds_song_to_the_end -v
```

The tests do not contact YouTube or need a running server. `uv sync` installs the project's dependencies, including yt-dlp; the test client skips the app startup check that would contact the network.

**Frontend**, from the `frontend/` folder:

```bash
npm ci
npm run lint
npm run build
```

`npm run build` also type-checks the code (`tsc -b`), so it catches TypeScript errors. ESLint may report warnings; the current CI command fails on lint errors, not warnings.

**What a red check means:** one of these commands failed on GitHub. Click **Details** next to the failed check on your PR, read the log, and reproduce the failure locally with the same command. Fix it, commit, and push again. The PR updates by itself.

## Writing a backend test

Tests live in `backend/tests/`. The pytest settings in `backend/pyproject.toml` point pytest at that folder, so you run `uv run pytest` from `backend/`. Test files are named `test_*.py` and test functions start with `test_`. Plain `assert` is all you need.

### A simple test to copy

This is adapted from `backend/tests/test_queue.py`. The file imports `KaraokeQueue` and `KaraokeEntry`, and defines `make_entry`; the example builds a queue, does one thing, and checks the result:

```python
def make_queue_with_songs(*titles: str) -> KaraokeQueue:
    queue = KaraokeQueue(items=[])
    for title in titles:
        queue.enqueue(make_entry(title))
    return queue

def titles_in(queue: KaraokeQueue) -> list[str]:
    return [item.entry.title for item in queue.items]

def test_dequeue_removes_the_matching_song():
    queue = make_queue_with_songs("Song A", "Song B", "Song C")
    id_of_b = queue.items[1].id

    queue.dequeue(id_of_b)

    assert titles_in(queue) == ["Song A", "Song C"]
```

Use the shape **arrange, act, assert**: set things up, call the thing, check the result. Keep one idea per test and give it a name that reads like a sentence. Helper functions such as `make_entry` and `make_queue_with_songs` keep tests short.

### HTTP tests: the `client` fixture

`backend/tests/conftest.py` defines a `client` fixture. It is a FastAPI `TestClient` wired to the real app, so you can call endpoints without starting a server. Add `client` as a test argument and pytest passes it in (this is how fixtures work, similar to a function argument that pytest fills for you). From `backend/tests/test_api.py`:

```python
def test_heartbeat_returns_ok(client):
    response = client.get("/heartbeat")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
```

`test_api.py` uses a `unique_room_id()` helper to give each test its own room, since the app's room manager is shared across requests.

### Faking time: the monkeypatch trick

`backend/tests/test_rate_limit.py` tests code that depends on the clock. Instead of waiting, it swaps `time.time` for a fake clock using pytest's built-in `monkeypatch` fixture:

```python
@pytest.fixture
def clock(monkeypatch):
    now = [1000.0]
    monkeypatch.setattr(rate_limit.time, "time", lambda: now[0])
    return now

def test_allows_again_after_the_window_has_passed(clock):
    limiter = SlidingWindowLimiter()
    for _ in range(3):
        limiter.allow("user", limit=3, window_seconds=10)

    clock[0] += 11   # "11 seconds pass"

    assert limiter.allow("user", limit=3, window_seconds=10) is True
```

`monkeypatch` undoes the swap after each test, so nothing leaks into other tests.

### Running one test

```bash
uv run pytest tests/test_queue.py::test_enqueue_adds_song_to_the_end -v
```

Run a whole file with `uv run pytest tests/test_queue.py -v`, or filter by name with `uv run pytest -k queue`.

## Frontend work

The frontend is in `frontend/src/`. If you know Python better than TypeScript, think of TypeScript as Python with type hints that the compiler enforces. `npm run build` tells you when the types do not match.

- `npm run dev` starts the Vite dev server with hot reload (needs the backend running for real data).
- `npm run storybook` opens [Storybook](https://storybook.js.org) at `http://localhost:6006`. It shows one component at a time with fake data, so you do not need the backend. This is the best way to work on UI polish.

Components live in `frontend/src/components/`, grouped by size:

| Folder | What goes there | Examples |
| --- | --- | --- |
| `atoms/` | Smallest building blocks | `Button.tsx`, `Input.tsx` |
| `molecules/` | A few atoms together | `SearchInput.tsx`, `IconButton.tsx` |
| `organisms/` | Larger pieces of UI | `QueueItem.tsx`, `ScoreScreen.tsx` |
| `templates/` | Page layouts | `ControllerLayout.tsx` |

Many components have a `*.stories.tsx` file next to them (for example `Button.stories.tsx`). That file is what Storybook shows. Copy an existing one to add stories for a new component.

The controller tabs live in `frontend/src/pages/controller/`. The display screens, video player, and `PlayerStateProvider.tsx` live in `frontend/src/pages/player/`; the provider coordinates playback and scoring. The tabs and screens are approachable places for a first change. `PlayerStateProvider.tsx` and `VideoPlayer.tsx` coordinate timing through effects and refs, so read the player guide before changing them.

If you need to read the display code, [frontend/docs/player.md](frontend/docs/player.md) explains how the player screens, the song lifecycle and the leader and follower displays fit together.

## How the app fits together

This is a short map. For the full protocol, see [backend/README.md](backend/README.md).

- **Display vs controller.** A client says which it is in its first message, `["handshake", {"client_type": "display"}]` or `"controller"`. Displays play video. Controllers search and send commands.
- **Rooms.** After the handshake, a client sends `["join_room", {"room_id": "..."}]`. Everything (queue, player state, settings) belongs to a room. State lives in memory in `backend/core/room.py`.
- **Message format.** Every WebSocket message is a JSON array of `[command, payload]`, for example `["queue_song", {...}]`. If the sender wants a reply, `request_id` is added to the payload and the server answers with `["ack", {"request_id": ..., "success": true, "result": ...}]`.
- **The leader display.** If a room has several displays, the first one is the **leader**. Only the leader reports playback state, and the others mirror it. If the leader leaves, another display is promoted. See `ensure_room_display_leader()` in `backend/session_manager.py`.

### Trace: a controller reserves a song

1. On the controller, the Reserve button in the song dialog (`frontend/src/pages/controller/useSongDialog.ts`) calls `queueSong(selected)`.
2. `queueSong` is defined in `frontend/src/hooks/useRoom.ts`. It calls `ws.sendCommandWithAck("queue_song", entry)`.
3. `sendCommandWithAck` in `frontend/src/hooks/useWebSocket.ts` adds a `request_id` and sends `["queue_song", {...entry, "request_id": "..."}]`.
4. The WebSocket loop in `backend/main.py` (the `/ws` endpoint) checks the payload with `validate_websocket_message()` from `backend/websocket_models.py`. It then finds a method with the same name as the command on `ControllerCommands` and calls it.
5. `ControllerCommands.queue_song()` in `backend/commands.py` turns the payload into a `KaraokeEntry` and calls `self.room.add_song(...)` (in `backend/core/room.py`). That adds it to the queue and bumps the queue version.
6. It then calls `_broadcast_room_state()`, which sends `["queue_update", {items, version, timestamp}]` to every client in the room (`SessionManager.broadcast_to_room`). It also sends `player_state` to the displays and starts fetching video URLs for the next two songs in the background.
7. The server sends the `ack` back to the sender, which resolves the promise returned by `queueSong`.
8. Back in the browser, the `queue_update` case in `useRoom.ts` stores the new queue (only if its `version` is newer), and the UI re-renders on every phone and display.
9. If nothing is playing, the leader display notices a reservation with nothing on air (an effect in `frontend/src/pages/player/PlayerStateProvider.tsx`) and sends `play_next`. `play_next` lives on the shared `ClientCommands` class in `commands.py`, so displays and controllers can both use it. It pops the queue and broadcasts the new state.

### Adding a new WebSocket command

1. Add an `async def your_command(self, payload)` method to `ControllerCommands` or `DisplayCommands` in `backend/commands.py`. The method name is the command name. Names starting with `_` are not reachable from the network.
2. Register it in `COMMAND_PAYLOAD_MAP` in `backend/websocket_models.py`, with a Pydantic payload class (or `dict` if there is nothing to validate). A command missing from this map is rejected as unknown, even if the method exists.
3. Add a sender in `frontend/src/hooks/useRoom.ts` (and its `RoomActions` type), using `ws.sendCommand` or `ws.sendCommandWithAck`.
4. Add a test, and document it in the commands reference in `backend/README.md`.

### Adding a new source provider

A source provider is what searches a video site and resolves playable URLs. Follow [Source Providers in backend/README.md](backend/README.md#source-providers). In short: subclass `KaraokeSourceProvider`, put it in `backend/source_providers/`, and register it in `backend/source_providers/registry.py`.

## Commit messages

The repo uses conventional-style prefixes. You can see them with `git log --oneline -30`:

- `feat:` a new feature
- `fix:` a bug fix
- `refactor:` code change that does not change behavior
- `docs:` documentation only
- `test:` adding or fixing tests
- `chore:` tooling, config, cleanup

Write the rest in the present tense and keep it short, for example `fix: ignore stale play_next requests` or `test: cover queue_next on an empty queue`. An optional scope is fine, like `fix(player): return to the idle screen`.

## PR checklist

Before you click **Create pull request**:

- [ ] The PR is small and focused on one thing
- [ ] The description says **what** changed and **why**
- [ ] It links the issue, for example `Closes #12`, so GitHub closes the issue when the PR is merged
- [ ] UI changes include a screenshot or short screen recording
- [ ] Behavior changes include a test
- [ ] `uv run pytest`, `npm run lint`, and `npm run build` pass locally
- [ ] You did not commit secrets, `.venv/`, or `node_modules/`

Reviewers may ask for changes. That is normal and part of how everyone learns. Push more commits to the same branch and the PR updates.

## Code of Conduct

By participating in this community you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md). Report problems by contacting the maintainer at the address listed there.

## Getting help

- Comment on the issue or on your PR. Say what you tried and paste the error message. No question is too small.
- Not sure which issue to take? Look for issues labelled `good first issue`.
