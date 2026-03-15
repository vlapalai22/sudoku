FROM python:3.11-slim-bookworm

WORKDIR /app

COPY index.html app.js sudoku.js style.css ./

EXPOSE 8080

CMD ["python", "-m", "http.server", "8080"]
