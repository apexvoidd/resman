from fastapi import APIRouter

router = APIRouter()


@router.get("/", status_code=200)
async def get_root():
    return {"status": "ok", "message": "Restaurant Management API Running"}
