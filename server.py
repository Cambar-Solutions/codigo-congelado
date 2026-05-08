import os
import json
import random
from flask import Flask, jsonify, send_from_directory, request
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder="static", static_url_path="")

API_KEY = os.environ.get("GEMINI_API_KEY")
client = genai.Client(api_key=API_KEY) if API_KEY else None

TOPICS = ["variables", "operadores aritmeticos", "condicionales if/else",
          "ciclos for", "ciclos while", "funciones", "arrays basicos",
          "strings y concatenacion", "comparaciones", "tipos de datos"]

QUESTION_SCHEMA = {
    "type": "object",
    "properties": {
        "question": {"type": "string"},
        "code": {"type": "string"},
        "options": {
            "type": "array",
            "items": {"type": "string"},
            "minItems": 4,
            "maxItems": 4,
        },
        "correctIndex": {"type": "integer"},
        "explanation": {"type": "string"},
    },
    "required": ["question", "code", "options", "correctIndex", "explanation"],
}

FALLBACK_QUESTIONS = [
    {
        "question": "Que imprime este codigo?",
        "code": "let x = 5;\nlet y = 3;\nconsole.log(x + y);",
        "options": ["8", "53", "x + y", "Error"],
        "correctIndex": 0,
        "explanation": "5 + 3 = 8 (suma numerica).",
    },
    {
        "question": "Que imprime este codigo?",
        "code": "let a = '2';\nlet b = 3;\nconsole.log(a + b);",
        "options": ["5", "23", "Error", "NaN"],
        "correctIndex": 1,
        "explanation": "Al ser string, concatena: '2' + 3 = '23'.",
    },
    {
        "question": "Cuantas veces imprime 'hi'?",
        "code": "for (let i = 0; i < 4; i++) {\n  console.log('hi');\n}",
        "options": ["3", "4", "5", "0"],
        "correctIndex": 1,
        "explanation": "i va de 0 a 3, son 4 iteraciones.",
    },
    {
        "question": "Que imprime?",
        "code": "let x = 10;\nif (x > 5) {\n  console.log('A');\n} else {\n  console.log('B');\n}",
        "options": ["A", "B", "AB", "Nada"],
        "correctIndex": 0,
        "explanation": "10 > 5 es true, imprime A.",
    },
    {
        "question": "Cual es el valor final de x?",
        "code": "let x = 2;\nx = x * 3;\nx = x + 1;\nconsole.log(x);",
        "options": ["6", "7", "9", "10"],
        "correctIndex": 1,
        "explanation": "2*3 = 6, luego 6+1 = 7.",
    },
]


@app.route("/", methods=["GET"])
def index():
    return send_from_directory("static", "index.html")


@app.route("/api/question", methods=["GET"])
def get_question():
    topic = random.choice(TOPICS)

    if not client:
        return jsonify(random.choice(FALLBACK_QUESTIONS))

    prompt = f"""Genera UNA pregunta de opcion multiple sobre programacion basica en JavaScript para alumnos de primer cuatrimestre.

Tema: {topic}

Reglas estrictas:
- "question": pregunta corta en espanol (ej: "Que imprime este codigo?", "Cual es el valor final?").
- "code": fragmento JS de 2 a 5 lineas, simple, sin trucos avanzados. Usa console.log cuando aplique.
- "options": exactamente 4 opciones cortas y plausibles (sin la letra A/B/C/D, solo el valor).
- "correctIndex": entero 0-3.
- "explanation": una sola linea breve explicando por que.
- No uses tildes ni caracteres especiales en el codigo.
- Variedad: no siempre uses x e y, alterna nombres.
"""

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=QUESTION_SCHEMA,
                temperature=1.0,
            ),
        )
        data = json.loads(response.text)
        if not (0 <= data.get("correctIndex", -1) <= 3):
            raise ValueError("bad index")
        if len(data.get("options", [])) != 4:
            raise ValueError("bad options")
        return jsonify(data)
    except Exception as e:
        print(f"[gemini error] {e}")
        return jsonify(random.choice(FALLBACK_QUESTIONS))


if __name__ == "__main__":
    port = int(os.environ.get("APP_PORT", 5000))
    host = os.environ.get("HOST", "127.0.0.1")
    app.run(host=host, port=port, debug=False)
