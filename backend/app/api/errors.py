from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class ApiProblem(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details or {}


def install_api_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiProblem)
    async def handle_api_problem(_request: Request, exc: ApiProblem) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=api_problem_payload(exc),
        )


def api_problem_payload(exc: ApiProblem) -> dict[str, Any]:
    return {
        "error": {
            "code": exc.code,
            "message": exc.message,
            "details": exc.details,
        }
    }
