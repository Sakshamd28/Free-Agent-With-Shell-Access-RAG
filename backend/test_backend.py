import sys
from fastapi.testclient import TestClient
from app import app

client = TestClient(app)

def test_endpoints():
    print("Testing /api/health...")
    res = client.get("/api/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    print("Health response:", res.json())

    print("\nTesting /api/models...")
    res = client.get("/api/models")
    assert res.status_code == 200, f"Models check failed: {res.text}"
    models_data = res.json()
    print(f"Available chat models: {len(models_data['chat_models'])}")
    print(f"Available embed models: {len(models_data['embed_models'])}")

    print("\nTesting /api/shell/exec with 'whoami'...")
    res = client.post("/api/shell/exec", json={"command": "whoami"})
    assert res.status_code == 200, f"Shell exec failed: {res.text}"
    shell_res = res.json()
    print("Shell response returncode:", shell_res["returncode"])
    print("Shell stdout:", shell_res["stdout"])

    print("\nTesting /api/kb/sources...")
    res = client.get("/api/kb/sources")
    assert res.status_code == 200, f"KB sources failed: {res.text}"
    print("KB sources response:", res.json())

    print("\nALL BACKEND TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_endpoints()
