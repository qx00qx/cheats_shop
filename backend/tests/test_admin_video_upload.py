from types import SimpleNamespace
from uuid import uuid4

from fastapi.testclient import TestClient

from app.api.deps import get_current_admin
from app.api.routes import uploads as uploads_route
from app.main import app


def make_video_upload_client(monkeypatch, tmp_path):
    previous = app.dependency_overrides.copy()
    app.dependency_overrides[get_current_admin] = lambda: SimpleNamespace(
        id=1,
        is_admin=True,
    )
    monkeypatch.setattr(uploads_route, "VIDEO_UPLOAD_DIR", tmp_path)
    monkeypatch.setattr(uploads_route, "VIDEO_CHUNKS_DIR", tmp_path / "chunks")
    return TestClient(app), previous


def test_admin_video_upload_saves_chunks_with_safe_filename(monkeypatch, tmp_path):
    client, previous = make_video_upload_client(monkeypatch, tmp_path)
    try:
        content = b"\x00\x00\x00\x18ftypisomvideo"
        upload_id = uuid4()
        chunk_response = client.put(
            f"/api/admin/uploads/videos/chunks/{upload_id}/0",
            params={"total_chunks": 1},
            content=content,
            headers={"Content-Type": "application/octet-stream"},
        )
        assert chunk_response.status_code == 200

        response = client.post(
            f"/api/admin/uploads/videos/finalize/{upload_id}",
            json={"filename": "demo clip.mp4", "total_chunks": 1},
        )
        assert response.status_code == 200
        result = response.json()
        assert result["filename"].startswith("demo-clip-")
        assert result["filename"].endswith(".mp4")
        assert result["url"] == f"/uploads/videos/{result['filename']}"
        assert result["size"] == len(content)
        assert (tmp_path / result["filename"]).read_bytes() == content
        assert not (tmp_path / "chunks" / str(upload_id)).exists()
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)


def test_admin_video_upload_rejects_invalid_content(monkeypatch, tmp_path):
    client, previous = make_video_upload_client(monkeypatch, tmp_path)
    upload_id = uuid4()
    try:
        client.put(
            f"/api/admin/uploads/videos/chunks/{upload_id}/0",
            params={"total_chunks": 1},
            content=b"invalid",
            headers={"Content-Type": "application/octet-stream"},
        )
        response = client.post(
            f"/api/admin/uploads/videos/finalize/{upload_id}",
            json={"filename": "not-a-video.mp4", "total_chunks": 1},
        )

        assert response.status_code == 415
        assert not list(tmp_path.glob(".*.tmp"))
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)


def test_admin_video_upload_rejects_oversized_file(monkeypatch, tmp_path):
    client, previous = make_video_upload_client(monkeypatch, tmp_path)
    monkeypatch.setattr(uploads_route, "VIDEO_CHUNK_SIZE", 12)
    try:
        response = client.post(
            f"/api/admin/uploads/videos/chunks/{uuid4()}/0",
            params={"total_chunks": 1},
            content=b"\x00" * 13,
            headers={"Content-Type": "application/octet-stream"},
        )

        assert response.status_code == 413
        assert not list((tmp_path / "chunks").glob("*/*.chunk"))
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)


def test_admin_video_upload_requires_admin(monkeypatch, tmp_path):
    client, previous = make_video_upload_client(monkeypatch, tmp_path)
    try:
        app.dependency_overrides.pop(get_current_admin, None)
        response = client.post(
            f"/api/admin/uploads/videos/finalize/{uuid4()}",
            json={"filename": "video.mp4", "total_chunks": 1},
        )

        assert response.status_code == 401
    finally:
        client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
