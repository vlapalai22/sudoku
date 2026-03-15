FROM python:3.11-slim-bookworm

WORKDIR /app

RUN python -m pip install --no-cache-dir --upgrade pip wheel==0.46.2

COPY index.html app.js sudoku.js style.css ./

EXPOSE 8080

CMD ["python", "-m", "http.server", "8080"]
