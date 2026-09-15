from app.api.errors import ApiProblem, api_problem_payload


def test_api_problem_uses_stable_error_envelope() -> None:
    problem = ApiProblem(409, "ACTIVE_SCAN_EXISTS", "Scan already active", {"scan_id": "scan-1"})

    assert problem.status_code == 409
    assert api_problem_payload(problem) == {
        "error": {
            "code": "ACTIVE_SCAN_EXISTS",
            "message": "Scan already active",
            "details": {"scan_id": "scan-1"},
        }
    }
