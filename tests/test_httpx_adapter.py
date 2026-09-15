from app.core.config import Settings
from app.scanners.httpx import HttpxAdapter


def test_httpx_adapter_resolves_local_target_and_preserves_hostname(monkeypatch) -> None:
    captured_commands: list[list[str]] = []

    monkeypatch.setattr("app.scanners.httpx.socket.gethostbyname", lambda host: "172.20.0.6")

    def fake_run_jsonl_command(command: list[str], timeout: int) -> list[dict]:
        captured_commands.append(command)
        return [
            {
                "input": "http://172.20.0.6:8088",
                "url": "http://172.20.0.6:8088",
                "host_ip": "172.20.0.6",
                "status_code": 200,
                "title": "Admin Panel",
                "tech": ["Nginx"],
            }
        ]

    monkeypatch.setattr("app.scanners.httpx.run_jsonl_command", fake_run_jsonl_command)
    settings = Settings(ENABLE_REAL_SCANNERS=True, LOCAL_REAL_SCANNERS=True)

    results = HttpxAdapter(settings).probe(["admin.lab.local:8088"])

    command = captured_commands[0]
    assert command[command.index("-H") + 1] == "Host: admin.lab.local"
    assert results[0].hostname == "admin.lab.local:8088"
    assert results[0].url == "http://admin.lab.local:8088"
    assert results[0].status_code == 200


def test_httpx_adapter_probes_local_targets_with_individual_host_headers(monkeypatch) -> None:
    captured_headers: list[str] = []
    monkeypatch.setattr("app.scanners.httpx.socket.gethostbyname", lambda host: "172.20.0.6")

    def fake_run_jsonl_command(command: list[str], timeout: int) -> list[dict]:
        host_header = command[command.index("-H") + 1]
        captured_headers.append(host_header)
        return [
            {
                "input": "http://172.20.0.6:8088",
                "url": "http://172.20.0.6:8088",
                "status_code": 200,
            }
        ]

    monkeypatch.setattr("app.scanners.httpx.run_jsonl_command", fake_run_jsonl_command)
    settings = Settings(ENABLE_REAL_SCANNERS=True, LOCAL_REAL_SCANNERS=True)

    results = HttpxAdapter(settings).probe(
        ["admin.lab.local:8088", "files.lab.local:8088"]
    )

    assert captured_headers == ["Host: admin.lab.local", "Host: files.lab.local"]
    assert [result.hostname for result in results] == [
        "admin.lab.local:8088",
        "files.lab.local:8088",
    ]


def test_httpx_adapter_prefers_successful_https_on_explicit_port(monkeypatch) -> None:
    def fake_run_jsonl_command(command: list[str], timeout: int) -> list[dict]:
        return [
            {
                "input": "http://example.com:4280",
                "url": "http://example.com:4280",
                "status_code": 400,
                "title": "Plain HTTP sent to HTTPS port",
            },
            {
                "input": "https://example.com:4280",
                "url": "https://example.com:4280",
                "status_code": 200,
                "title": "Application",
            },
        ]

    monkeypatch.setattr("app.scanners.httpx.run_jsonl_command", fake_run_jsonl_command)
    settings = Settings(ENABLE_REAL_SCANNERS=True, ALLOWED_TARGET_DOMAINS="example.com")

    results = HttpxAdapter(settings).probe(["example.com:4280"])

    assert len(results) == 1
    assert results[0].hostname == "example.com:4280"
    assert results[0].url == "https://example.com:4280"
    assert results[0].status_code == 200
    assert results[0].title == "Application"
