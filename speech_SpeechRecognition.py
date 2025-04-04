import speech_recognition as sr

# Initialize the recognizer
recognizer = sr.Recognizer()

def record_and_recognize():
    try:
        # Use the microphone as the audio source
        with sr.Microphone() as source:
            print("Listening...")
            recognizer.adjust_for_ambient_noise(source)  # Adjust for background noise
            audio = recognizer.listen(source)  # Capture audio input
            
            print("Recognizing...")
            # Use Google's speech recognition API to convert speech to text
            text = recognizer.recognize_google(audio)
            print(f"You said: {text}")
    except sr.UnknownValueError:
        print("Sorry, I couldn't understand that.")
    except sr.RequestError as e:
        print(f"Request error: {e}")

if __name__ == "__main__":
    record_and_recognize()