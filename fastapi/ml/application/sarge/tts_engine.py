from TTS.api import TTS
import torch
from loguru import logger

class XTTSEngine:
    def __init__(self, speaker_wav=None, language="en"):
        import os
        os.environ["COQUI_TOS_AGREED"] = "1"
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"🎙️ TTS: Initializing XTTS v2 on {self.device}")

        self.tts = TTS(
            model_name="tts_models/multilingual/multi-dataset/xtts_v2",
            gpu=self.device == "cuda"
        )

        self.speaker_wav = speaker_wav
        self.language = language

    def speak(self, text: str, output_path: str):
        logger.info(f"🎙️ TTS: Synthesizing to {output_path} (Language: {self.language})")
        self.tts.tts_to_file(
            text=text,
            speaker_wav=self.speaker_wav,
            language=self.language,
            file_path=output_path
        )
