from fastapi import APIRouter


class Router(APIRouter):
    def add_api_route(self, path, endpoint, **kwargs):
        kwargs["description"] = kwargs.get("description") or endpoint.__doc__ or kwargs.get("summary")
        if kwargs.get("response_description") in (None, "Successful Response"):
            kwargs["response_description"] = "Successful result. See the response schema for field details."
        super().add_api_route(path, endpoint, **kwargs)
