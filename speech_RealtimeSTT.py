from RealtimeSTT import AudioToTextRecorder

def process_text(text):
    """Callback function to process and print transcribed text."""
    print(f"Transcribed Text: {text}")

if __name__ == "__main__":
    print("Wait until it says 'Speak now'...")
    
    # Initialize the recorder
    recorder = AudioToTextRecorder()
    
    # Continuously process transcribed text
    while True:
        recorder.text(process_text)