import requests
from bs4 import BeautifulSoup
import re
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

# Define input schema
class URLInput(BaseModel):
    artist: str
    title: str

energy_scores = {
    'low energy': 0.2,
    'average energy': 0.4,
    'energy': 0.6,
    'high energy': 0.8,
    'very high energy': 1
}
energy_weight = 0.75

danceable_scores = {
    'not very danceable': 0.25,
    'somewhat danceable': 0.5,
    'danceable': 0.75,
    'very danceable': 1
}
danceable_weight = 0.25

@app.post("/analyze-song/")
def analyze_song(data: URLInput):
    # Format the URL based on artist and title
    artist_formatted = data.artist.replace(' ', '-').lower()
    title_formatted = data.title.replace(' ', '-').lower()
    url = f"https://songbpm.com/@{artist_formatted}/{title_formatted}"

    try:
        response = requests.get(url)
        soup = BeautifulSoup(response.text, 'html.parser')

        # Extract energy and danceability
        semi_bold_spans = soup.find_all('span', class_='font-semibold')
        energy_score = 0
        danceable_score = 0

        for span in semi_bold_spans:
            text = span.text.strip()
            if 'energy' in text:
                energy_score = energy_scores.get(text, 0)
            elif 'danceable' in text:
                danceable_score = danceable_scores.get(text, 0)

        runability_score = energy_score * energy_weight + danceable_score * danceable_weight

        # Extract duration
        bpm_dt = soup.find('dt', text=re.compile(r'Duration\s'))
        duration = bpm_dt.find_next_sibling('dd').text.strip() if bpm_dt else "Unknown"

        return {
            "duration": duration,
            "runability_score": runability_score
        }

    except Exception as e:
        print(f"Error processing the URL: {str(e)}")

