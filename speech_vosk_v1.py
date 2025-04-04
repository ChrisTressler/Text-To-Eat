import vosk
import sys
import sounddevice as sd
import queue
import audioop

# 2 channel, 16 bit, 48kHz
# Path to Vosk model
model_path = r"C:/Utils/vosk-model-small-en-us-0.15/vosk-model-small-en-us-0.15"
model = vosk.Model(model_path)

recognizer = vosk.KaldiRecognizer(model, 16000)
audio_queue = queue.Queue()

def callback(indata, frames, time, status):
    if status:
        print(f"Status: {status}", file=sys.stderr)
    # Resample audio from 48 kHz to 16 kHz mono PCM
    resampled_data = audioop.ratecv(indata, 2, 1, 48000, 16000, None)[0]
    audio_queue.put(resampled_data)

def record_and_recognize():
    try:
        print("Listening...")
        with sd.InputStream(samplerate=48000, channels=1, dtype='int16', callback=callback):
            while True:
                data = audio_queue.get()
                if recognizer.AcceptWaveform(data):
                    result = recognizer.Result()
                    print(f"You said: {result}")
                else:
                    print(recognizer.PartialResult())
    except KeyboardInterrupt:
        print("\nStopped listening.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    record_and_recognize()