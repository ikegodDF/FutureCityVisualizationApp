# 設定管理
from pydantic_settings import BaseSettings
from typing import List
import os

class Settings(BaseSettings):
    app_name: str = "FutureCity API"
    version: str = "0.1.0"
    debug: bool = False
    
    # データファイルパス
    data_dir: str = "data"
    models_file: str = "models.json"
    config_file: str = "config.json"
    seismic_intensity_file: str = "seismic/seismic_intensity.csv"
    tsunami_inundation_depth_file: str = "tsunami/tsunami_inundation_depth_toyoura.csv"
    tsunami_evacuation_file: str = "tsunami/津波避難データ_豊浦.csv"
    # CORS
    cors_origins: str = "http://localhost:5173"
    
    # 計算設定
    max_models_per_request: int = 1000
    cache_ttl_seconds: int = 300
    
    class Config:
        env_file = ".env"

settings = Settings()