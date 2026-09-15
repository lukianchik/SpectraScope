from app.core.config import Settings
from app.scanners.nuclei import NucleiAdapter


def test_nuclei_adapter_passes_templates_path(monkeypatch) -> None:
    captured_commands: list[list[str]] = []

    def fake_run_jsonl_command(command: list[str], timeout: int) -> list[dict]:
        captured_commands.append(command)
        return [
            {
                "host": "https://api.example.com",
                "matched-at": "https://api.example.com/login",
                "template-id": "demo-template",
                "info": {
                    "name": "Demo Finding",
                    "severity": "low",
                    "description": "Template path smoke test.",
                },
            }
        ]

    monkeypatch.setattr("app.scanners.nuclei.run_jsonl_command", fake_run_jsonl_command)

    settings = Settings(
        ENABLE_REAL_SCANNERS=True,
        NUCLEI_TEMPLATES_PATH="./lab/nuclei-templates",
        SCANNER_TIMEOUT_SECONDS=5,
    )
    findings = NucleiAdapter(settings).scan(["https://api.example.com"])

    assert captured_commands == [
        [
            "nuclei",
            "-u",
            "https://api.example.com",
            "-jsonl",
            "-severity",
            "info,low,medium,high,critical",
            "-exclude-tags",
            "intrusive,dos,fuzz",
            "-rate-limit",
            "20",
            "-bulk-size",
            "10",
            "-concurrency",
            "10",
            "-t",
            "./lab/nuclei-templates",
        ]
    ]
    assert findings[0].template_id == "demo-template"


def test_nuclei_adapter_resolves_local_target_and_preserves_evidence_host(monkeypatch) -> None:
    captured_commands: list[list[str]] = []

    monkeypatch.setattr("app.scanners.nuclei.socket.gethostbyname", lambda host: "172.20.0.6")

    def fake_run_jsonl_command(command: list[str], timeout: int) -> list[dict]:
        captured_commands.append(command)
        return [
            {
                "host": "172.20.0.6",
                "matched-at": "http://172.20.0.6:8088/",
                "template-id": "spectrascope-exposed-admin-panel-demo",
                "info": {"name": "Exposed Admin Panel Demo", "severity": "high"},
            }
        ]

    monkeypatch.setattr("app.scanners.nuclei.run_jsonl_command", fake_run_jsonl_command)
    settings = Settings(
        ENABLE_REAL_SCANNERS=True,
        LOCAL_REAL_SCANNERS=True,
        NUCLEI_TEMPLATES_PATH="/opt/spectrascope/templates",
    )

    findings = NucleiAdapter(settings).scan(["http://admin.lab.local:8088"])

    command = captured_commands[0]
    assert command[command.index("-u") + 1] == "http://172.20.0.6:8088"
    assert command[command.index("-H") + 1] == "Host: admin.lab.local"
    assert findings[0].host == "http://admin.lab.local:8088"
    assert findings[0].matched_at == "http://admin.lab.local:8088"
