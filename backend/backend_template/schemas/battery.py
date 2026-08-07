from pydantic import BaseModel
class BatteryInput(BaseModel):
 voltage:float
 current:float
 temperature:float
 soc:float
 cycle_count:int
 capacity:float
