"""
LLM client.

Every AI-backed pipeline (translation, OCR, data extraction, lease
abstraction) calls through this module rather than hitting
OpenRouter/OpenAI's HTTP APIs directly - that's what makes swapping
providers, adding retry/rate-limit handling, or mocking the LLM out in
tests a one-file change instead of a grep across every pipeline.

`LlmClient` is injected into pipeline services as a constructor
argument (not imported and called as a bare module function) specifically
so tests can substitute `FakeLlmClient` and verify the surrounding
job/billing/storage logic without making a real network call or needing
API credentials - see tests/test_translation_service.py.
"""
import base64
from abc import ABC, abstractmethod

import httpx
from fastapi import HTTPException, status

from app.core.config import settings


class LlmClient(ABC):
    @abstractmethod
    async def complete(self, system_prompt: str, user_prompt: str) -> str:
        """Send a single-turn text prompt, return the model's text response."""

    @abstractmethod
    async def complete_with_image(self, system_prompt: str, user_prompt: str, image_png: bytes) -> str:
        """Send a single-turn prompt with an attached image (vision
        models only) - used by OCR and lease abstraction, which send
        rendered PDF pages rather than extracted text."""


class OpenRouterClient(LlmClient):
    """Real client - actually calls OpenRouter's chat completions
    endpoint. Requires OPENROUTER_API_KEY to be set."""

    def __init__(self):
        if not settings.OPENROUTER_API_KEY:
            raise HTTPException(
                status.HTTP_500_INTERNAL_SERVER_ERROR,
                "OPENROUTER_API_KEY is not configured on this server.",
            )

    async def complete(self, system_prompt: str, user_prompt: str) -> str:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.OPENROUTER_API_KEY}"},
                json={
                    "model": settings.OPENROUTER_MODEL,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                },
            )
        return _extract_content(response)

    async def complete_with_image(self, system_prompt: str, user_prompt: str, image_png: bytes) -> str:
        data_uri = _png_to_data_uri(image_png)
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.OPENROUTER_API_KEY}"},
                json={
                    "model": settings.OPENROUTER_MODEL,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": [
                            {"type": "text", "text": user_prompt},
                            {"type": "image_url", "image_url": {"url": data_uri}},
                        ]},
                    ],
                },
            )
        return _extract_content(response)


class OpenAIClient(LlmClient):
    """Real client - actually calls OpenAI's chat completions endpoint.
    Requires OPENAI_API_KEY to be set."""

    def __init__(self):
        if not settings.OPENAI_API_KEY:
            raise HTTPException(
                status.HTTP_500_INTERNAL_SERVER_ERROR,
                "OPENAI_API_KEY is not configured on this server.",
            )

    async def complete(self, system_prompt: str, user_prompt: str) -> str:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                json={
                    "model": settings.OPENAI_MODEL,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                },
            )
        return _extract_content(response)

    async def complete_with_image(self, system_prompt: str, user_prompt: str, image_png: bytes) -> str:
        data_uri = _png_to_data_uri(image_png)
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                json={
                    "model": settings.OPENAI_MODEL,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": [
                            {"type": "text", "text": user_prompt},
                            {"type": "image_url", "image_url": {"url": data_uri}},
                        ]},
                    ],
                },
            )
        return _extract_content(response)


def _png_to_data_uri(image_png: bytes) -> str:
    return f"data:image/png;base64,{base64.b64encode(image_png).decode('ascii')}"


def _extract_content(response: httpx.Response) -> str:
    if response.status_code != 200:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            f"LLM provider returned an error ({response.status_code}): {response.text[:300]}",
        )
    data = response.json()
    return data["choices"][0]["message"]["content"]


def get_llm_client() -> LlmClient:
    if settings.LLM_PROVIDER == "openai":
        return OpenAIClient()
    return OpenRouterClient()
