from fastapi.testclient import TestClient

from app.main import app
from app.search import load_dataset

client = TestClient(app)


def test_health_check() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "skypath-api"}


def test_dataset_is_loaded_during_application_startup() -> None:
    load_dataset.cache_clear()

    with TestClient(app):
        cache_info = load_dataset.cache_info()

    assert cache_info.misses == 1
    assert cache_info.currsize == 1

