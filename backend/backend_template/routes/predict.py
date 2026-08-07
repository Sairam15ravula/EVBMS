# pyrefly: ignore [missing-import]
from fastapi import APIRouter
router=APIRouter(prefix='/predict')
@router.post('/all')
def predict(data:dict):
 return {'message':'implement services','input':data}
