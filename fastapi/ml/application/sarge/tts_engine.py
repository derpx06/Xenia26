from TTS.api import TTS
from ml.application.sarge.openvoice_engine import OpenVoiceEngine
import torch
from loguru import logger

class XTTSEngine(OpenVoiceEngine):
    """
    Backwards compatibility wrapper for renamed TTS engine.
    """
    def __init__(self, speaker_wav=None, language="en"):
        super().__init__(speaker_wav=speaker_wav, language=language)
        
    def tts_to_file(self, text, file_path, speaker_wav=None, language="en-us"):
        # Interface mapping for nodes.py
        return self.speak(text, file_path)
