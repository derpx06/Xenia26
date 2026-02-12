from ml.application.sarge.openvoice_engine import OpenVoiceEngine

class XTTSEngine(OpenVoiceEngine):
    """
    Backwards compatibility wrapper for renamed TTS engine.
    """
    def __init__(self, speaker_wav=None, language="en"):
        super().__init__(speaker_wav=speaker_wav, language=language)
        self.active_speaker_wav = speaker_wav

    def ensure_speaker(self, speaker_wav: str | None):
        """
        Switch cloning reference only when needed to avoid repeated embedding extraction.
        """
        if not speaker_wav:
            return
        if speaker_wav == self.active_speaker_wav:
            return
        self.update_speaker(speaker_wav)
        # Only mark active after a successful extraction.
        self.active_speaker_wav = speaker_wav

    def clear_speaker(self):
        super().clear_speaker()
        self.active_speaker_wav = None
        
    def tts_to_file(self, text, file_path, speaker_wav=None, language="en-us"):
        # Interface mapping for nodes.py
        self.ensure_speaker(speaker_wav)
        return self.speak(text, file_path)
