# Flask Speech-to-Text Application

This branch provides 3 variant of real-time speech-to-text conversion using Python libraries- `SpeechRecognition`, `RealtimeSTT`, and `vosk`. The application can capture audio input from a microphone and transcribe speech into text in real time.

## Installation

### Prerequisites
Ensure you have Python 3 installed on your system. 

### Install Dependencies
Run the following commands to install the required dependencies:

```sh
pip install Flask SpeechRecognition pyaudio
# OR
pip install pyaudio

pip install vosk
pip install sounddevice
pip install RealtimeSTT
pip install flask gunicorn SpeechRecognition
```

Download "vosk-model-small-en-us-0.15" from the following site:
https://alphacephei.com/vosk/models
and change the path in speech_vosk_v1.py and speech_vosk_v2.py to the local folder paths.

## Usage

1. Run the application and open a web browser and navigate to `http://127.0.0.1:5000/` to access the speech-to-text interface.

## Resources recommended for development

- [Flask Speech-to-Text](https://github.com/Vatsalparsaniya/Flask-speech-to-text)
- [Voice-to-Text with Python in Flask](https://github.com/ruslanmv/Voice-to-text-with-Python-in-Flask)
- [Mozilla DeepSpeech](https://github.com/mozilla/DeepSpeech)
- [RealtimeSTT](https://github.com/KoljaB/RealtimeSTT)
- [Reddit Discussion 1](https://www.reddit.com/r/Python/comments/170iwzc/i_developed_a_realtime_speech_to_text_library/)
- [Reddit Discussion 2](https://www.reddit.com/r/MachineLearning/comments/1ifbd48/dwhat_is_the_best_speech_recognition_model_now/)
- [YouTube Tutorial](https://www.youtube.com/watch?v=eykWtp-Bt8A)
