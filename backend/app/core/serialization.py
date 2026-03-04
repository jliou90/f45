from __future__ import annotations

from typing import TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)
def out(model: type[T], obj) -> T:
    return model.model_validate(obj, from_attributes=True)
